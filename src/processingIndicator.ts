/** Presentation only: callers decide whether a real operation is pending. */
export function processingDots(className = '', label = 'Processing') {
  const indicator=document.createElement('span');indicator.className=`processing-dots ${className}`;
  indicator.setAttribute('role','status');indicator.setAttribute('aria-label',label);
  for(let i=0;i<3;i++){const dot=document.createElement('span');dot.setAttribute('aria-hidden','true');indicator.append(dot);}
  return indicator;
}
export function searchStatus(status:string, active:boolean) {
  const label=document.createElement('span');label.className='search-status';label.dataset.status=status;
  const mark=document.createElement('span');mark.className='search-status-mark';mark.setAttribute('aria-hidden','true');
  mark.textContent=status==='complete'?'✓':status==='failed'?'!':'•';
  if(status==='running'&&active)mark.classList.add('is-running');
  label.append(mark,document.createTextNode(status));return label;
}
