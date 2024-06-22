import { Application } from "./Application";
import '@fortawesome/fontawesome-free/js/all.min.js'

function boot() {
	if (document.visibilityState !== 'visible') {
		return;
	}

	if (!Application.checkBrowser()) {
		return;
	}

	// @ts-ignore
	window.app = new Application();

	document.removeEventListener('visibilitychange', boot);
	document.removeEventListener('DOMContentLoaded', boot);
}

document.addEventListener('visibilitychange', boot);
document.addEventListener('DOMContentLoaded', boot);