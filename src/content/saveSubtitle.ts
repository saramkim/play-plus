import { REVIEW, SUBTITLE_TOOLTIP_ID } from '../utils/constants';
import { setLocalStorage } from '../utils/storage';
import { createTooltip, showToast } from '../utils/dom';
import { getMessage } from '../utils/i18n';
import { getLocalStorage } from '../utils/storage';

export function setupSubtitleSaveHandler(subtitleElement: HTMLElement) {
  const tooltip = getTooltip();
  const showTooltip = (event: MouseEvent) => {
    subtitleElement.style.borderColor = 'currentColor';
    tooltip.style.opacity = '1';
    updateTooltipPosition(event);
  };
  const updateTooltipPosition = (event: MouseEvent) => {
    tooltip.style.top = `${event.pageY + 10}px`;
    tooltip.style.left = `${event.pageX + 10}px`;
  };
  const hideTooltip = () => {
    subtitleElement.style.borderColor = 'transparent';
    tooltip.style.opacity = '0';
  };
  const handleSubtitleClick = async (event: MouseEvent) => {
    event.stopPropagation();
    hideTooltip();
    saveSubtitleWithToast(subtitleElement);
  };

  subtitleElement.addEventListener('mouseover', showTooltip);
  subtitleElement.addEventListener('mousemove', updateTooltipPosition);
  subtitleElement.addEventListener('mouseout', hideTooltip);
  subtitleElement.addEventListener('click', handleSubtitleClick);
}

export async function saveSubtitleWithToast(subtitleElement: HTMLElement) {
  try {
    const subtitle = await saveSubtitle(subtitleElement);
    showToast(getMessage('success_save_subtitle'), subtitle, 'success');
  } catch (error) {
    showToast(getMessage('error_save_subtitle'), (error as Error).message, 'error');
  }
}

function getTooltip(): HTMLElement {
  const existingTooltip = document.getElementById(SUBTITLE_TOOLTIP_ID);
  if (existingTooltip) return existingTooltip;

  const tooltip = createTooltip(getMessage('click_to_save'));
  tooltip.id = SUBTITLE_TOOLTIP_ID;
  document.body.appendChild(tooltip);
  return tooltip;
}

async function saveSubtitle(subtitleElement: HTMLElement) {
  const content = subtitleElement.textContent?.replace(/\n/g, ' ');
  const startTimeDataAttribute = subtitleElement.dataset[REVIEW.DATA_ATTRIBUTE.START_TIME];

  if (!content) throw new Error(getMessage('error_no_subtitle'));

  const startTime = Number(startTimeDataAttribute || 0);
  const prevData = await getLocalStorage(REVIEW.STORAGE_KEY);
  const isDuplicated = prevData?.some(({ content: prevContent }) => prevContent === content);
  if (isDuplicated) throw new Error(getMessage('error_duplicate_subtitle'));

  const data = { content, url: window.location.href, startTime, savedAt: new Date().toISOString() };
  await setLocalStorage(REVIEW.STORAGE_KEY, prevData ? [data, ...prevData] : [data]);

  return content;
}
