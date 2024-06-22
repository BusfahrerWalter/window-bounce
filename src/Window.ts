import { Bounds, Vector, Vertex, Vertices } from "matter-js";
import { Application } from "./Application";
import hull from 'hull.js';
import { Util } from "./util/Util";

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Line {
	from: Vector;
	to: Vector;
}

interface IndexedVector {
	vector: Vector;
	index: number
}

export class ClientWindow {

	private readonly app: Application;

	public get innerSize(): Vector {
		return Vector.create(window.innerWidth, window.innerHeight);
	}

	public get outerSize(): Vector {
		return Vector.create(window.outerWidth, window.outerHeight);
	}

	public get position(): Vector {
		const x = window.screenX;
		const y = window.screenY;
		const sizeDifference = Vector.sub(this.outerSize, this.innerSize);
		return Vector.create(x + sizeDifference.x, y + sizeDifference.y);
	}

	public get rect(): Rect {
		const pos = this.position;
		const size = this.innerSize;
		return {
			x: pos.x,
			y: pos.y,
			width: size.x,
			height: size.y
		};
	}

	constructor(app: Application) {
		this.app = app;
		this.init();
	}

	private init() {
		const windows = this.getWindowIDs();
		windows.push(this.app.id);
		this.app.storage.set('windows', windows);
	}

	public contains(bounds: Bounds): boolean {
		const rect = this.rect;
		if (bounds.max.x < rect.x || bounds.min.x > rect.x + rect.width || bounds.max.y < rect.y || bounds.min.y > rect.y + rect.height) {
			return false;
		}
		return true;
	}

	public getWindowIDs(): string[] {
		return this.app.storage.get('windows') ?? [];
	}

	public pageToScreenPoint(pagePoint: Vector): Vector {
		return Vector.add(this.position, pagePoint);
	}

	public screenToPagePoint(screenPoint: Vector): Vector {
		return Vector.sub(screenPoint, this.position);
	}

	public async getBorder(thickness: number = 50): Promise<Vector[]> {
		const outline = await this.getOutline();
		const extruded: Vector[] = [];

		// insert notch point
		const notchPoint = Vector.div(Vector.add(outline[outline.length - 1], outline[0]), 2);
		outline.unshift(Vector.create(notchPoint.x, notchPoint.y));
		outline.push(notchPoint);

		for (let i = 0; i < outline.length; i++) {
			const vertex = outline[i];
			const prevVertex = outline[i === 0 ? outline.length - 1 : i - 1];
			const nextVertex = outline[(i + 1) % outline.length];

			const edge1 = Vector.sub(vertex, prevVertex);
			const edge2 = Vector.sub(nextVertex, vertex);

			// calculate normals perpendicular to the edge
			const normal1 = Vector.normalise(Vector.perp(edge1));
			const normal2 = Vector.normalise(Vector.perp(edge2));

			// average the normals to get the extrusion direction
			const normal = Vector.normalise(Vector.add(normal1, normal2));

			// extrude vertex
			const extrudedVertex = Vector.add(vertex, Vector.mult(normal, -thickness));
			extruded.push(extrudedVertex);
		}

		return outline.concat(extruded.reverse());
	}

	public async getOutline(): Promise<Vector[]> {
		// get all rects
		const infos = await this.app.getInfos();
		const bounds: Bounds[] = infos.map(info => {
			return Util.rectToBounds(info.rect);
		});

		// get all bounds & vertices
		const rects: {
			bounds: Bounds,
			inset: Bounds,
			vertices: Vector[]
		}[] = [];

		for (const bound of bounds) {
			rects.push({
				bounds: bound,
				inset: Util.inflateBounds(bound, -1),
				vertices: [
					Vector.create(bound.min.x, bound.min.y),
					Vector.create(bound.min.x, bound.max.y),
					Vector.create(bound.max.x, bound.max.y),
					Vector.create(bound.max.x, bound.min.y)
				]
			});
		}

		// get edge intersection points
		const intersectionVertices: Vector[] = [];
		for (let i = 0; i < rects.length; i++) {
			for (let j = i + 1; j < rects.length; j++) {
				const rect1 = rects[i];
				const rect2 = rects[j];

				if (rect1 === rect2) {
					continue;
				}

				const overlaps = Bounds.overlaps(rect1.bounds, rect2.bounds);
				if (!overlaps) {
					continue;
				}

				const intersectionPoints = this.getRectIntersectionPoints(rect1.bounds, rect2.bounds);
				const filtered = intersectionPoints.map(point => {
					return Vector.create(point.x, point.y);
				}).filter(vertex => {
					return !rects.some(rect => Bounds.contains(rect.inset, vertex));
				});

				intersectionVertices.push(...filtered);
			}
		}

		// filter out vertices which are contained in other rects
		let vertices: Vector[] = [];
		for (const rect of rects) {
			for (const vertex of rect.vertices) {
				const isContained = rects.some(r => {
					return r === rect ? false : Bounds.contains(r.bounds, vertex);
				});

				if (!isContained) {
					vertices.push(Vector.create(vertex.x, vertex.y));
				}
			}
		}

		const all = vertices.concat(intersectionVertices).sort((a, b) => {
			return a.x === b.x ? a.y - b.y : a.x - b.x;
		});

		const sorted: Vector[] = [];
		let current: number|Vector = 0;

		while (all.length) {
			const next = this.getNextPoint(all, current);
			sorted.push(next.vector);
			all.splice(next.index, 1);
			current = next.vector;
		}

		return sorted;
	}

	public getRectIntersectionPoints(rect1: Bounds, rect2: Bounds): Vector[] {
		const getEdgeSet = (rect: Bounds): Line[] => [
			{ from: Vector.create(rect.min.x, rect.min.y), to: Vector.create(rect.max.x, rect.min.y) },
			{ from: Vector.create(rect.max.x, rect.min.y), to: Vector.create(rect.max.x, rect.max.y) },
			{ from: Vector.create(rect.max.x, rect.max.y), to: Vector.create(rect.min.x, rect.max.y) },
			{ from: Vector.create(rect.min.x, rect.max.y), to: Vector.create(rect.min.x, rect.min.y) }
		];

		const edgeSet1 = getEdgeSet(rect1);
		const edgeSet2 = getEdgeSet(rect2);
		const points: Vector[] = [];

		for (const edge1 of edgeSet1) {
			for (const edge2 of edgeSet2) {
				if (edge1 === edge2) {
					continue;
				}

				const intersectionPoint = this.getLineIntersectionPoint(edge1, edge2);
				if (intersectionPoint) {
					points.push(intersectionPoint);
				}
			}
		}

		return points;
	}

	public getLineIntersectionPoint(line1: Line, line2: Line): Vector|null {
		const eq1 = this.lineEquation(line1.from, line1.to);
		const eq2 = this.lineEquation(line2.from, line2.to);

		if (eq1.slope === eq2.slope) {
			return null;
		}

		if (eq1.slope === Infinity) {
			return this.checkSlope(line2, line1);
		}
		if (eq2.slope === Infinity) {
			return this.checkSlope(line1, line2);
		}

		const x = (eq2.yIntercept - eq1.yIntercept) / (eq1.slope - eq2.slope);
		const y = eq1.slope * x + eq1.yIntercept;
		return Vector.create(x, y);
	}

	private checkSlope(line1: Line, line2: Line): Vector|null {
		const point = Vector.create(line2.from.x, line1.from.y);
		const xMin = Math.min(line1.from.x, line1.to.x);
		const xMax = Math.max(line1.from.x, line1.to.x);
		if (point.x < xMin || point.x > xMax) {
			return null;
		}

		const yMin = Math.min(line2.from.y, line2.to.y);
		const yMax = Math.max(line2.from.y, line2.to.y);
		if (point.y < yMin || point.y > yMax) {
			return null;
		}

		return point;
	}

	private lineEquation(p1: Vector, p2: Vector): { slope: number, yIntercept: number } {
		if (p2.x - p1.x === 0) {
			return {
				slope: Infinity,
				yIntercept: Infinity
			};
		}

		const slope = (p2.y - p1.y) / (p2.x - p1.x);
		const yIntercept = p1.y - slope * p1.x;
		return { slope, yIntercept };
	}

	private getNextPoint(list: Vector[], current: number|Vector): IndexedVector {
		const currentPoint = typeof current === 'number' ? list[current] : current;
		if (!currentPoint) {
			return {
				vector: list[0],
				index: 0
			};
		}

		const find = (checker: (point: Vector) => boolean): IndexedVector|null => {
			let minDistance = Infinity;
			let result = null;
			let index = -1;
			for (let i = 0; i < list.length; i++) {
				const point = list[i];
				if (point === currentPoint || !checker(point)) {
					continue;
				}

				const distance = Vector.magnitude(Vector.sub(point, currentPoint));
				if (distance < minDistance) {
					minDistance = distance;
					result = point;
					index = i;
				}
			}

			return result ? {
				vector: result,
				index: index
			} : null;
		};

		const vector =
			find(point => point.x === currentPoint.x && point.y < currentPoint.y) ?? // top
			find(point => point.y === currentPoint.y && point.x > currentPoint.x) ?? // right
			find(point => point.x === currentPoint.x && point.y > currentPoint.y) ?? // bottom
			find(point => point.y === currentPoint.y && point.x < currentPoint.x);   // left

		if (!vector) {
			return {
				vector: list[0],
				index: 0
			};
		}

		return vector;
	}
}