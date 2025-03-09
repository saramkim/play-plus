import { getLocalStorage, setLocalStorage } from '@storage/index';
import { REVIEW } from '@utils/constants';
import { t } from '@utils/i18n';

import { createTooltip, showToast } from '@/content/utils/dom';

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
    showToast(t('success_save_subtitle'), subtitle, 'success');
  } catch (error) {
    showToast(t('error_save_subtitle'), (error as Error).message, 'error');
  }
}

const SUBTITLE_TOOLTIP_ID = 'pp-subtitle-tooltip';

function getTooltip(): HTMLElement {
  const existingTooltip = document.getElementById(SUBTITLE_TOOLTIP_ID);
  if (existingTooltip) return existingTooltip;

  const tooltip = createTooltip(t('click_to_save'));
  tooltip.id = SUBTITLE_TOOLTIP_ID;
  document.body.appendChild(tooltip);
  return tooltip;
}

async function saveSubtitle(subtitleElement: HTMLElement) {
  const content = subtitleElement.textContent?.replace(/\n/g, ' ');
  const startTimeDataAttribute = subtitleElement.dataset[REVIEW.DATA_ATTRIBUTE.START_TIME];

  if (!content) throw new Error(t('error_no_subtitle'));

  const startTime = Number(startTimeDataAttribute || 0);
  const prevData = await getLocalStorage(REVIEW.STORAGE_KEY);
  const isDuplicated = prevData?.some(({ content: prevContent }) => prevContent === content);
  if (isDuplicated) throw new Error(t('error_duplicate_subtitle'));

  const data = { content, url: window.location.href, startTime, savedAt: new Date().toISOString() };
  await setLocalStorage(REVIEW.STORAGE_KEY, prevData ? [data, ...prevData] : [data]);

  return content;
}
