import { getStorage, setStorage } from '../storage';
import '../style.css';

document.addEventListener('DOMContentLoaded', async () => {
  const skipTime = await getStorage('skipTime');
  const input = document.getElementById('skip-time') as HTMLInputElement;
  input.value = skipTime.toString();

  document.getElementById('save-skip-time')?.addEventListener('click', async () => {
    const input = document.getElementById('skip-time') as HTMLInputElement;
    const seconds = parseInt(input.value, 10);

    if (!isNaN(seconds) && seconds > 0) {
      await setStorage('skipTime', seconds);
      const feedback = document.getElementById('feedback') as HTMLDivElement;
      feedback.classList.remove('hidden');
      setTimeout(() => feedback.classList.add('hidden'), 800);
    }
  });
});
