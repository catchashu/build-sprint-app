export function explainerClose(close: () => void) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'explainer-close';
  button.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span>Close</span>';
  button.onclick = close;
  return button;
}

export function audienceTabs(names: string[], paragraphs: string[]) {
  const tabs = document.createElement('div'); tabs.className = 'audience-tabs';
  tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Who you are planning for');
  const content = document.createElement('p'); content.id = 'audience-content';
  content.setAttribute('role', 'tabpanel'); content.tabIndex = 0;
  const buttons = names.map((name, index) => {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = name; button.id = `audience-tab-${index}`;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', content.id);
    button.onclick = () => select(index);
    button.onkeydown = event => {
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? names.length - 1
        : ['ArrowRight', 'ArrowDown'].includes(event.key) ? (index + 1) % names.length
        : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? (index + names.length - 1) % names.length : -1;
      if (next < 0) return;
      event.preventDefault(); select(next); buttons[next].focus();
    };
    tabs.append(button); return button;
  });
  function select(index: number) {
    buttons.forEach((button, i) => { button.setAttribute('aria-selected', String(i === index)); button.tabIndex = i === index ? 0 : -1; });
    content.textContent = paragraphs[index]; content.setAttribute('aria-labelledby', buttons[index].id);
  }
  select(0);
  return { tabs, content };
}
