import { Vector } from "matter-js";
import { Application } from "./Application";
import { Menu } from "./menu/Menu";
import menu from "./config/menu";

export class ContextMenu {

	private readonly app: Application;
	private menu?: Menu;

	public position: Vector;

	public get isOpen(): boolean {
		return !!this.menu;
	}

	constructor(app: Application) {
		this.app = app;
		this.position = Vector.create(0, 0);
		window.addEventListener('contextmenu', this.onContextMenu.bind(this));
	}

	private onContextMenu(evt: MouseEvent) {
		this.open(Vector.create(evt.pageX, evt.pageY));
		evt.preventDefault();
	}

	public open(position: Vector) {
		this.position = this.app.window.pageToScreenPoint(position);
		this.menu = new Menu(null, menu(this.app));
		this.menu.show(position);
	}

	public close() {
		this.menu?.close();
	}
}