import './content.css';
import { contentRuntime } from './content-runtime';

void contentRuntime.start().catch((error) => console.error('Content runtime failed to start:', error));
