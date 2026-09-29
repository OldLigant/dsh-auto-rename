window.__ModuleLoader__.load({
  id: '@local/dsh-auto-rename',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const dictionaries = {
      en: { action: 'Auto rename', success: 'Title generated', error: 'Auto rename failed' },
      zh: { action: '自动命名', success: '自动命名成功', error: '自动命名失败' },
    };
    const styles = `
      .dsh-auto-rename-item { display:flex; align-items:center; gap:6px; width:100%; min-height:34px; padding:6px 8px; border:0; border-radius:var(--dsw-radius-md); background:transparent; cursor:pointer; font-size:13px; line-height:20px; color:var(--dsw-alias-label-primary); text-align:left; }
      .dsh-auto-rename-item:hover, .dsh-auto-rename-item:focus-visible { background:var(--dsw-alias-interactive-bg-hover); }
      .dsh-auto-rename-item:focus-visible { outline:none; }
      .dsh-auto-rename-icon { display:inline-flex; flex:none; align-items:center; justify-content:center; width:14px; height:14px; color:var(--dsw-alias-menu-icon); }
      .dsh-auto-rename-label { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dsh-auto-rename-notices { position:fixed; right:24px; bottom:24px; z-index:10; display:flex; flex-direction:column; align-items:flex-end; gap:8px; max-width:min(360px, calc(100vw - 32px)); pointer-events:none; }
      .dsh-auto-rename-notice { box-sizing:border-box; max-width:100%; padding:10px 14px; border:1px solid var(--dsw-alias-border-l1); border-left-width:3px; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-overlay); color:var(--dsw-alias-label-primary); font-size:13px; line-height:20px; overflow-wrap:anywhere; box-shadow:0 4px 16px var(--dsw-alias-border-l2); }
      .dsh-auto-rename-notice[data-kind="success"] { border-left-color:var(--dsw-alias-state-success-primary); }
      .dsh-auto-rename-notice[data-kind="error"] { border-left-color:var(--dsw-alias-state-error-primary); }
    `;
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('autoRename', dictionaries));
        const t = ctx.locale.bind('autoRename');
        const pending = new Set();
        const listeners = new Set();
        const timers = new Set();
        let notices = [];
        let nextId = 0;
        let active = true;
        ctx.effect(() => () => {
          active = false;
          for (const timer of timers) clearTimeout(timer);
          timers.clear();
          listeners.clear();
          pending.clear();
        });
        const publish = () => { for (const listener of listeners) listener(notices); };
        function notify(kind, message) {
          if (!active) return;
          const id = ++nextId;
          notices = [...notices.slice(-2), { id, kind, message }];
          publish();
          const timer = setTimeout(() => {
            timers.delete(timer);
            notices = notices.filter((notice) => notice.id !== id);
            publish();
          }, kind === 'error' ? 6000 : 4000);
          timers.add(timer);
        }
        function Notices() {
          const [visible, setVisible] = React.useState(notices);
          React.useEffect(() => {
            listeners.add(setVisible);
            setVisible(notices);
            return () => listeners.delete(setVisible);
          }, []);
          return h(React.Fragment, null,
            h('style', null, styles),
            visible.length > 0 && h('div', { className: 'dsh-auto-rename-notices', role: 'status', 'aria-live': 'polite' },
              visible.map((notice) => h('div', {
                key: notice.id, className: 'dsh-auto-rename-notice', 'data-kind': notice.kind,
              }, notice.message))));
        }
        function MenuItem({ sessionId, useMenuOpenState }) {
          const [, setOpen] = useMenuOpenState();
          const run = async () => {
            setOpen(false);
            if (pending.has(sessionId)) return;
            pending.add(sessionId);
            try {
              const response = await fetch('/api/local.auto-rename.refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
              notify('success', `${t('success')}: ${result.title}`);
            } catch (reason) {
              notify('error', `${t('error')}: ${reason instanceof Error ? reason.message : String(reason)}`);
            } finally {
              pending.delete(sessionId);
            }
          };
          return h('button', {
            type: 'button', role: 'menuitem', className: 'dsh-auto-rename-item',
            'aria-label': t('action'), onClick: run,
          },
            h('span', { className: 'dsh-auto-rename-icon', 'aria-hidden': true },
              h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7 },
                h('path', { d: 'M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3zM19 17l.7 1.3L21 19l-1.3.7L19 21l-.7-1.3L17 19l1.3-.7L19 17z' }))),
            h('span', { className: 'dsh-auto-rename-label' }, t('action')));
        }
        ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({
          name: 'sidebar.workspaces.session.menu.item', id: 'dsh-auto-rename', order: 150,
          label: () => t('action'),
        }, MenuItem));
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'dsh-auto-rename-notices',
        }, Notices));
      },
    };
  },
});
