import { Bounds, Vector } from "matter-js";
// @ts-ignore No types ...
import * as ClipperLib from 'clipper-lib';
import { Application } from "./Application";
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

interface BoundInfo {
	bounds: Bounds;
	vertices: Vector[];
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
		return this.app.storage.get('windows', []);
	}

	public pageToScreenPoint(pagePoint: Vector): Vector {
		return Vector.add(this.position, pagePoint);
	}

	public screenToPagePoint(screenPoint: Vector): Vector {
		return Vector.sub(screenPoint, this.position);
	}

	public async getBorder(thickness: number = 50): Promise<Vector[][]> {
		const outlineGroups = await this.getOutline();
		const borderGroups: Vector[][] = [];

		for (const group of outlineGroups) {
			const extruded: Vector[] = [];

			// insert notch point (required for a valid physics shape hull)
			group.push(Vector.create(group[0].x, group[0].y));

			for (let i = 0; i < group.length; i++) {
				const vertex = group[i];
				const prevVertex = group[i === 0 ? group.length - 1 : i - 1];
				const nextVertex = group[(i + 1) % group.length];

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

			borderGroups.push(group.concat(extruded.reverse()));
		}

		return borderGroups;
	}

	public async getOutline(): Promise<Vector[][]> {
		// get all rects
		const infos = await this.app.getInfos();
		const bounds: Bounds[] = infos.map(info => {
			return Util.rectToBounds(info.rect);
		});

		const vertexLists: Vector[][] = [];
		const rects: Set<BoundInfo> = new Set();

		// get all bounds & vertices
		for (const bound of bounds) {
			rects.add({
				bounds: bound,
				vertices: [
					Vector.create(bound.min.x, bound.min.y), // top left
					Vector.create(bound.max.x, bound.min.y), // top right
					Vector.create(bound.max.x, bound.max.y), // bottom right
					Vector.create(bound.min.x, bound.max.y) // bottom left
				]
			});
		}

		// group all rects and build individual polygons
		while (rects.size > 0) {
			const first = rects.values().next().value as BoundInfo;
			if (!first) {
				break;
			}

			const overlapping: BoundInfo[] = [];
			for (const rect of rects) {
				if (rect === first || Bounds.overlaps(rect.bounds, first.bounds)) {
					overlapping.push(rect);
				}
			}

			for (const rect of overlapping) {
				rects.delete(rect);
			}

			const polygons = overlapping.map(rect => rect.vertices);
			const result = this.merge(polygons);
			vertexLists.push(result);
		}

		return vertexLists;
	}

	private merge(rects: Vector[][]): Vector[] {
		if (rects.length === 1) {
			return rects[0];
		}

		const clipper = new ClipperLib.Clipper();
		clipper.AddPath(rects[0].map(vector => {
			return new ClipperLib.IntPoint(vector.x, vector.y);
		}), ClipperLib.PolyType.ptSubject, true);

		for (let i = 1; i < rects.length; i++) {
			clipper.AddPath(rects[i].map(vector => {
				return new ClipperLib.IntPoint(vector.x, vector.y);
			}), ClipperLib.PolyType.ptClip, true);
		}

		const solution = new ClipperLib.Paths();
		clipper.Execute(ClipperLib.ClipType.ctUnion, solution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

		return solution[0].map((point: any) => {
			return Vector.create(point.X, point.Y);
		});
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
}