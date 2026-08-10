/**
 * Build installable extension zips + a clean source zip (no tests / smoke).
 *
 * Usage:
 *   node scripts/package-release.mjs
 *   node scripts/package-release.mjs --version=1.0.0-rc.1
 */
import { spawn } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const extPkgPath = resolve(root, 'apps/extension/package.json')
const args = new Set(process.argv.slice(2))
const versionArg = [...args].find((a) => a.startsWith('--version='))
const version =
  versionArg?.slice('--version='.length) ||
  JSON.parse(readFileSync(extPkgPath, 'utf8')).version

const FORBIDDEN_NAME =
  /(\.test\.|\.spec\.|vitest|smoke|puppeteer|playwright|__tests__|\.smoke)/i

function run(cmd, cmdArgs, cwd = root) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, cmdArgs, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    child.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${cmd} ${cmdArgs.join(' ')} exited ${code}`))
    })
  })
}

function releaseDirOrTemp() {
  const dir = resolve(root, 'release')
  mkdirSync(dir, { recursive: true })
  return dir
}

async function zipDir(srcDir, zipPath) {
  rmSync(zipPath, { force: true })
  if (process.platform === 'win32') {
    const scriptPath = join(releaseDirOrTemp(), `zip-${Date.now()}.ps1`)
    const script = `
$ErrorActionPreference = 'Stop'
$src = ${JSON.stringify(srcDir)}
$dest = ${JSON.stringify(zipPath)}
if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Force }
Compress-Archive -Path (Join-Path $src '*') -DestinationPath $dest -Force
`
    writeFileSync(scriptPath, script, 'utf8')
    try {
      await new Promise((resolvePromise, reject) => {
        const child = spawn(
          'powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
          { stdio: 'inherit' },
        )
        child.on('exit', (code) => {
          if (code === 0) resolvePromise()
          else reject(new Error(`Compress-Archive failed: ${code}`))
        })
      })
    } finally {
      rmSync(scriptPath, { force: true })
    }
    return
  }
  await new Promise((resolvePromise, reject) => {
    const child = spawn('tar', ['-a', '-c', '-f', zipPath, '-C', srcDir, '.'], {
      stdio: 'inherit',
    })
    child.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`tar zip failed: ${code}`))
    })
  })
}

function shouldCopySource(relPath) {
  const norm = relPath.replace(/\\/g, '/')
  if (!norm || norm === '.') return false
  if (norm.startsWith('node_modules/')) return false
  if (norm.startsWith('release/')) return false
  if (norm.startsWith('.git/')) return false
  if (norm.startsWith('apps/extension/.output/')) return false
  if (norm.startsWith('apps/extension/.wxt/')) return false
  if (norm.startsWith('.smoke')) return false
  if (norm.includes('/docs/qa/')) return false
  if (norm.includes('/docs/superpowers/')) return false
  if (/(^|\/)\.env($|\.)/i.test(norm)) return false
  if (/\.env$/i.test(norm)) return false
  if (/test-modelskey\.env$/i.test(norm)) return false
  if (FORBIDDEN_NAME.test(norm)) return false
  if (norm === 'pnpm-lock.yaml') return true
  return true
}

function collectSourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'release') continue
    const abs = join(dir, name)
    const rel = relative(root, abs)
    const st = statSync(abs)
    if (st.isDirectory()) {
      if (!shouldCopySource(rel + '/')) continue
      collectSourceFiles(abs, out)
    } else if (shouldCopySource(rel)) {
      out.push(rel)
    }
  }
  return out
}

function assertCleanZipListing(entries, label) {
  const bad = entries.filter(
    (e) =>
      FORBIDDEN_NAME.test(e) ||
      /docs\/qa|docs\/superpowers|smoke-extension|\.env|test-modelskey/i.test(e),
  )
  if (bad.length) {
    throw new Error(`[package] ${label} contains forbidden paths:\n${bad.join('\n')}`)
  }
}

async function listZipEntries(zipPath) {
  if (process.platform === 'win32') {
    const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::OpenRead(${JSON.stringify(zipPath)}).Entries | ForEach-Object { $_.FullName }
`
    return await new Promise((resolvePromise, reject) => {
      const chunks = []
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-Command', ps],
        { stdio: ['ignore', 'pipe', 'inherit'] },
      )
      child.stdout.on('data', (d) => chunks.push(d))
      child.on('exit', (code) => {
        if (code !== 0) reject(new Error(`zip list failed: ${code}`))
        else {
          resolvePromise(
            Buffer.concat(chunks)
              .toString('utf8')
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      })
    })
  }
  return []
}

async function main() {
  const releaseDir = releaseDirOrTemp()

  const pkg = JSON.parse(readFileSync(extPkgPath, 'utf8'))
  if (pkg.version !== version) {
    pkg.version = version
    writeFileSync(extPkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
    console.log(`[package] bumped extension version → ${version}`)
  }

  // Guard: repo must not still expose test/smoke entrypoints.
  const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  for (const banned of ['test', 'smoke', 'smoke:keep']) {
    if (rootPkg.scripts?.[banned]) {
      throw new Error(`[package] root package.json still has script "${banned}"`)
    }
  }
  if (existsSync(resolve(root, 'scripts/smoke-extension.mjs'))) {
    throw new Error('[package] scripts/smoke-extension.mjs still exists')
  }

  console.log('[package] building chrome-mv3…')
  await run('pnpm', ['--filter', '@tonkatsu-translate/extension', 'build'])

  let firefoxOk = false
  try {
    console.log('[package] building firefox…')
    await run('pnpm', [
      '--filter',
      '@tonkatsu-translate/extension',
      'build:firefox',
    ])
    firefoxOk = true
  } catch (error) {
    console.warn(
      '[package] firefox build failed (non-fatal):',
      error instanceof Error ? error.message : error,
    )
  }

  const chromeOut = resolve(root, 'apps/extension/.output/chrome-mv3')
  if (!existsSync(join(chromeOut, 'manifest.json'))) {
    throw new Error(`Missing chrome build: ${chromeOut}`)
  }

  const chromeZip = join(
    releaseDir,
    `tonkatsu-translate-v${version}-chrome-mv3.zip`,
  )
  await zipDir(chromeOut, chromeZip)
  const chromeEntries = await listZipEntries(chromeZip)
  assertCleanZipListing(chromeEntries, 'chrome zip')
  console.log(`[package] wrote ${chromeZip} (${chromeEntries.length} entries)`)

  if (firefoxOk) {
    const ffCandidates = [
      resolve(root, 'apps/extension/.output/firefox-mv3'),
      resolve(root, 'apps/extension/.output/firefox-mv2'),
    ]
    const ffOut = ffCandidates.find((p) => existsSync(join(p, 'manifest.json')))
    if (ffOut) {
      const label = ffOut.includes('mv3') ? 'firefox-mv3' : 'firefox-mv2'
      const ffZip = join(
        releaseDir,
        `tonkatsu-translate-v${version}-${label}.zip`,
      )
      await zipDir(ffOut, ffZip)
      assertCleanZipListing(await listZipEntries(ffZip), 'firefox zip')
      console.log(`[package] wrote ${ffZip}`)
    }
  }

  // Clean source tree for distribution (plugin monorepo only).
  const srcStage = join(releaseDir, `source-stage-v${version}`)
  rmSync(srcStage, { recursive: true, force: true })
  mkdirSync(srcStage, { recursive: true })
  const files = collectSourceFiles(root)
  for (const rel of files) {
    const from = resolve(root, rel)
    const to = resolve(srcStage, rel)
    mkdirSync(dirname(to), { recursive: true })
    cpSync(from, to)
  }
  const sourceZip = join(
    releaseDir,
    `tonkatsu-translate-v${version}-source.zip`,
  )
  await zipDir(srcStage, sourceZip)
  const sourceEntries = await listZipEntries(sourceZip)
  assertCleanZipListing(sourceEntries, 'source zip')
  rmSync(srcStage, { recursive: true, force: true })
  console.log(`[package] wrote ${sourceZip} (${sourceEntries.length} entries)`)

  const notes = join(releaseDir, `NOTES-v${version}.md`)
  writeFileSync(
    notes,
    `# Tonkatsu Translate v${version}

Clean release (GitHub sideload; **not** Chrome Web Store).

## Assets

- \`tonkatsu-translate-v${version}-chrome-mv3.zip\` — installable extension (load unpacked)
- \`tonkatsu-translate-v${version}-source.zip\` — plugin source only (no tests / smoke / QA harness)
${firefoxOk ? `- experimental Firefox zip (about:debugging)\n` : ''}
## Install (Chrome / Edge)

1. Unzip the chrome-mv3 zip
2. \`chrome://extensions\` → Developer mode → Load unpacked

## Build from source zip

\`\`\`bash
pnpm install
pnpm build
\`\`\`

This source tree does **not** include automated test or smoke harnesses.
`,
    'utf8',
  )
  console.log(`[package] wrote ${notes}`)
  console.log('[package] OK — clean artifacts ready')
}

main().catch((error) => {
  console.error('[package] failed:', error)
  process.exit(1)
})
