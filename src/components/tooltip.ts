const TOOLTIP_DISTANCE = 2;

interface TooltipProps {
  id: string;
  message: string;
  target: HTMLElement;
}
export function Tooltip({ id, message, target }: TooltipProps) {
  const tooltipTemplate = (document.getElementById('tooltip-template') as HTMLTemplateElement).content.cloneNode(
    true
  ) as DocumentFragment;
  const tooltip = tooltipTemplate.querySelector('[data-role="tooltip"]') as HTMLDivElement;

  if (id) tooltip.id = id;
  tooltip.textContent = message;
  document.body.appendChild(tooltip);

  const showTooltip = () => {
    tooltip.classList.remove('hidden');

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let top = targetRect.bottom + TOOLTIP_DISTANCE;
    let left = targetRect.left + TOOLTIP_DISTANCE;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const scrollbarHeight = window.innerHeight - document.documentElement.clientHeight;

    if (left + tooltipRect.width > window.innerWidth - scrollbarWidth) {
      left = window.innerWidth - tooltipRect.width - TOOLTIP_DISTANCE - scrollbarWidth;
    }
    if (top + tooltipRect.height > window.innerHeight - scrollbarHeight) {
      top = targetRect.top - tooltipRect.height - TOOLTIP_DISTANCE;
    }

    tooltip.style.top = `${top + window.scrollY}px`;
    tooltip.style.left = `${left + window.scrollX}px`;
  };

  const hideTooltip = () => {
    tooltip.classList.add('hidden');
  };

  target.addEventListener('mouseenter', showTooltip);
  target.addEventListener('mouseleave', hideTooltip);

  return tooltip;
}
