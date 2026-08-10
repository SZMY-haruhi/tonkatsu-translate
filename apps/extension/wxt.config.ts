import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: '炸猪排翻译',
    description: '极简 BYOK 网页双语翻译扩展（Alpha 测试版）',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: ['<all_urls>'],
    options_ui: {
      open_in_tab: true,
    },
    web_accessible_resources: [
      {
        resources: ['icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png'],
        matches: ['<all_urls>'],
      },
    ],
    commands: {
      'translate-page': {
        suggested_key: {
          default: 'Alt+Shift+T',
        },
        description: '翻译当前页面',
      },
      'restore-page': {
        suggested_key: {
          default: 'Alt+Shift+R',
        },
        description: '还原当前页面',
      },
    },
  },
});
