import './geodraw.css';
// @ts-expect-error
import * as maplibregl from 'maplibre-gl';
import type { LngLat } from 'maplibre-gl';

let drawColor = '#000';
let lineWidth = 4;

interface Feature {
	type: 'Feature';
	geometry: {
		type: 'LineString';
		coordinates: Array<Array<number>>;
	};
	properties: {};
}

class gitDrawings {
	map: maplibregl.Map;
	geojsonDrawings: Array<Feature> = [];
	undoHistory: Array<Feature> = [];
	constructor(map: maplibregl.Map) {
		this.map = map;
		if (typeof (this.map as any).isStyleLoaded === 'function' && this.map.isStyleLoaded()) {
			this.init();
		} else {
			this.map.once('load', () => this.init());
		}
	}

	init() {
		this.map.addSource('drawingsSource', {
			type: 'geojson',
			data: {
				type: 'FeatureCollection',
				features: []
			}
		});

		this.map.addLayer({
			id: 'drawings-lines',
			type: 'line',
			source: 'drawingsSource',

			filter: ['==', '$type', 'LineString'],

			paint: {
				'line-color': drawColor,
				'line-width': lineWidth
			}
		});
	}

	deInit() {
		this.map.removeSource('drawingsSource');
		this.map.removeLayer('drawings-lines');
	}

	updateLayerColor(color: string) {
		this.map.setPaintProperty('drawings-lines', 'line-color', color);
	}

	updateSourceLayer() {
		const drawingsSourceLayer = this.map.getSource('drawingsSource') as maplibregl.GeoJSONSource;
		drawingsSourceLayer.setData({
			type: 'FeatureCollection',
			features: this.geojsonDrawings
		});
	}

	undoLastAction() {
		const lastElement = this.geojsonDrawings.pop();
		if (lastElement != undefined) {
			this.undoHistory.push(lastElement);
		}
		this.updateSourceLayer();
	}

	redoAction() {
		const lastAction = this.undoHistory.pop();
		if (lastAction != undefined) {
			this.geojsonDrawings.push(lastAction);
		}
		this.updateSourceLayer();
	}

	pushStroke(coordinates: Array<Array<number>>) {
		if (coordinates.length < 2) return; // Need at least 2 points for a line
		if (this.undoHistory.length > 0) {
			this.undoHistory = [];
		}

		this.geojsonDrawings.push({
			type: 'Feature',
			geometry: {
				type: 'LineString',
				coordinates: coordinates
			},
			properties: {}
		});
		this.updateSourceLayer();
	}

	saveToObject() {
		return { drawings: this.geojsonDrawings };
	}

	loadFeatures(features: Feature[]) {
		this.geojsonDrawings = features;
		this.updateSourceLayer();
	}
}

// remember to add the enter and esc listeners for multiline + implement active document listeners clearer in the _clearSelection
class DrawTools {
	map: maplibregl.Map;
	toolBarDiv!: HTMLElement;
	toolbarStates: Map<string, boolean>;
	activeListeners: Map<string, { functions: Array<{ func: Function; listener: string }> }>;
	activeDocumentListeners: Map<string, { functions: Array<{ func: Function; listener: string }> }>;
	gitForDrawings: gitDrawings;
	constructor(map: maplibregl.Map) {
		this.map = map;
		this.toolbarStates = new Map();
		this.activeListeners = new Map();
		this.activeDocumentListeners = new Map();
		this.gitForDrawings = new gitDrawings(this.map);
		this.initToolbar();
	}

	_clearSelection() {
		const allTools = document.querySelectorAll('.gToolsIcon');
		allTools.forEach((tool) => {
			tool.classList.remove('gToolsSelected');
		});
		this.toolbarStates.forEach((_, key) => {
			this.toolbarStates.set(key, false);
		});
		this.activeListeners.forEach((pkg, toolId) => {
			pkg.functions.forEach((funct) => {
				// @ts-expect-error
				this.map.off(funct.listener, funct.func);
			});
		});
		this.activeListeners.clear();
		this.activeDocumentListeners.forEach((pkg, toolId) => {
			pkg.functions.forEach((funct) => {
				// @ts-expect-error
				document.removeEventListener(funct.listener, funct.func);
			});
		});
	}

	_selectTool(id: string, toolDiv: HTMLElement | HTMLDivElement) {
		this.toolbarStates.set(id, true);
		toolDiv.classList.add('gToolsSelected');
	}

	createTool(
		id: string,
		name: string,
		icon: string,
		segment: HTMLDivElement | HTMLElement,
		runtime: Function,
		startSelected: boolean = false
	) {
		const toolDiv = document.createElement('div');
		toolDiv.classList.add('gToolsIcon');
		if (startSelected) {
			this.toolbarStates.set(id, true);
			toolDiv.classList.add('gToolsSelected');
		} else {
			this.toolbarStates.set(id, false);
		}
		toolDiv.title = name;

		toolDiv.addEventListener('click', () => {
			this._clearSelection();
			this._selectTool(id, toolDiv);
			runtime(id, runtime);
		});

		const toolIcon = document.createElement('div');
		toolIcon.innerHTML = icon;
		toolDiv.append(toolIcon);
		segment.append(toolDiv);
	}

	lockMap() {
		this.map.boxZoom.disable();
		this.map.doubleClickZoom.disable();
		this.map.dragPan.disable();
		this.map.dragRotate.disable();
		this.map.keyboard.disable();
		this.map.scrollZoom.disable();
		this.map.touchZoomRotate.disable();
		this.map.touchPitch.disable();
	}

	unlockMap() {
		this.map.boxZoom.enable();
		this.map.doubleClickZoom.enable();
		this.map.dragPan.enable();
		this.map.keyboard.enable();
		this.map.scrollZoom.enable();
		this.map.touchZoomRotate.enable({ around: 'center' });
		this.map.touchZoomRotate.disableRotation();
		this.map.dragRotate.disable();
		this.map.touchPitch.disable();
	}

	cursorRuntime(id: string, runtime: Function) {
		this.unlockMap();
	}

	freehandRuntime(id: string, runtime: Function) {
		// example
		this.lockMap();
		let mouseDown = false;
		let mouseDownStart: LngLat;
		let previewElement: HTMLCanvasElement;
		let strokeCoordinates: Array<Array<number>> = [];
		let deltaScreenCoord: maplibregl.Point | null = null;

		const handleMouseDown = (event: any) => {
			mouseDown = true;
			mouseDownStart = event.lngLat;
			strokeCoordinates = [[event.lngLat.lng, event.lngLat.lat]];

			previewElement = document.createElement('canvas');
			const mapContainer = this.map.getContainer();
			const rect = mapContainer.getBoundingClientRect();

			previewElement.width = mapContainer.offsetWidth;
			previewElement.height = mapContainer.offsetHeight;
			previewElement.style.position = 'fixed';
			previewElement.style.left = rect.left + 'px';
			previewElement.style.top = rect.top + 'px';
			previewElement.style.pointerEvents = 'none';
			previewElement.style.zIndex = '1000';
			previewElement.classList.add('gToolsPreviewOverlay');

			const ctx = previewElement.getContext('2d')!;
			ctx.clearRect(0, 0, previewElement.width, previewElement.height);
			ctx.strokeStyle = drawColor;
			ctx.lineWidth = lineWidth;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			document.body.append(previewElement);
			deltaScreenCoord = null;
		};

		const handleMouseMove = (event: any) => {
			if (mouseDown) {
				const screenPoint = event.point;
				strokeCoordinates.push([event.lngLat.lng, event.lngLat.lat]);

				const ctx = previewElement.getContext('2d')!;
				ctx.beginPath();
				if (deltaScreenCoord) {
					ctx.moveTo(deltaScreenCoord.x, deltaScreenCoord.y);
				} else {
					ctx.moveTo(screenPoint.x, screenPoint.y);
				}
				ctx.lineTo(screenPoint.x, screenPoint.y);
				ctx.stroke();

				deltaScreenCoord = screenPoint;
			}
		};
		// direct reference like this
		const handleMouseUp = (event: any) => {
			mouseDown = false;

			this.gitForDrawings.pushStroke(strokeCoordinates);
			strokeCoordinates = [];
			deltaScreenCoord = null;
			//remove previewOverlay
			setTimeout(() => {
				previewElement.remove();
			}, 30);
		};

		this.map.on('mousedown', handleMouseDown);
		this.map.on('mousemove', handleMouseMove);
		this.map.on('mouseup', handleMouseUp);

		// define what you listen for, make sure they are direct references or it complains
		this.activeListeners.set(id, {
			functions: [
				{ func: handleMouseDown, listener: 'mousedown' },
				{ func: handleMouseMove, listener: 'mousemove' },
				{ func: handleMouseUp, listener: 'mouseup' }
			]
		});
	}

	pencilRuntime(id: string, runtime: Function) {
		this.lockMap();
		let firstPoint: Array<number> | undefined = undefined;
		let lastPoint: Array<number> | undefined = undefined;
		let previewElement: HTMLCanvasElement;
		let startScreenCoord: maplibregl.Point | null = null;

		const handleMouseDown = (event: maplibregl.MapMouseEvent) => {
			if (firstPoint == undefined) {
				firstPoint = [event.lngLat.lng, event.lngLat.lat];
				previewElement = document.createElement('canvas');
				const mapContainer = this.map.getContainer();
				const rect = mapContainer.getBoundingClientRect();

				previewElement.width = mapContainer.offsetWidth;
				previewElement.height = mapContainer.offsetHeight;
				previewElement.style.position = 'fixed';
				previewElement.style.left = rect.left + 'px';
				previewElement.style.top = rect.top + 'px';
				previewElement.style.pointerEvents = 'none';
				previewElement.style.zIndex = '1000';
				previewElement.classList.add('gToolsPreviewOverlay');
				const ctx = previewElement.getContext('2d')!;
				ctx.clearRect(0, 0, previewElement.width, previewElement.height);
				ctx.strokeStyle = drawColor;
				ctx.lineWidth = lineWidth;
				ctx.lineCap = 'round';
				ctx.lineJoin = 'round';

				document.body.append(previewElement);
				startScreenCoord = event.point;
			} else {
				lastPoint = [event.lngLat.lng, event.lngLat.lat];
			}

			if (firstPoint != undefined && lastPoint != undefined) {
				this.gitForDrawings.pushStroke([firstPoint, lastPoint]);
				firstPoint = undefined;
				lastPoint = undefined;
				setTimeout(() => {
					previewElement.remove();
				}, 20);
			}
		};

		const handleMouseMove = (event: any) => {
			const screenPoint = event.point;
			if (firstPoint != undefined) {
				const ctx = previewElement.getContext('2d')!;
				ctx.clearRect(0, 0, previewElement.width, previewElement.height);
				ctx.beginPath();

				if (startScreenCoord) {
					ctx.moveTo(startScreenCoord.x, startScreenCoord.y);
				} else {
					ctx.moveTo(screenPoint.x, screenPoint.y);
				}
				ctx.lineTo(screenPoint.x, screenPoint.y);
				ctx.stroke();
			}
		};

		this.map.on('click', handleMouseDown);
		this.map.on('mousemove', handleMouseMove);

		this.activeListeners.set(id, {
			functions: [
				{ func: handleMouseDown, listener: 'click' },
				{ func: handleMouseMove, listener: 'mousemove' }
			]
		});
	}

	multilineRuntime(id: string, runtime: Function) {
		this.lockMap();
		let points: Array<Array<number>> | null = null;
		let previewElement: HTMLCanvasElement;
		let screenCoords: Array<maplibregl.Point> | null = null;

		const handleMouseDown = (event: maplibregl.MapMouseEvent) => {
			if (points == null) {
				points = [];
				points.push([event.lngLat.lng, event.lngLat.lat]);
				previewElement = document.createElement('canvas');

				const mapContainer = this.map.getContainer();
				const rect = mapContainer.getBoundingClientRect();

				previewElement.width = mapContainer.offsetWidth;
				previewElement.height = mapContainer.offsetHeight;
				previewElement.style.position = 'fixed';
				previewElement.style.left = rect.left + 'px';
				previewElement.style.top = rect.top + 'px';
				previewElement.style.pointerEvents = 'none';
				previewElement.style.zIndex = '1000';
				previewElement.classList.add('gToolsPreviewOverlay');

				const ctx = previewElement.getContext('2d')!;
				ctx.clearRect(0, 0, previewElement.width, previewElement.height);
				ctx.strokeStyle = drawColor;
				ctx.lineWidth = lineWidth;
				ctx.lineCap = 'round';
				ctx.lineJoin = 'round';

				document.body.append(previewElement);

				screenCoords = [];
				screenCoords.push(event.point);
			} else {
				points.push([event.lngLat.lng, event.lngLat.lat]);
				screenCoords!.push(event.point);
			}
		};

		const handleMouseMove = (event: any) => {
			const screenPoint = event.point;
			if (screenCoords != null) {
				const ctx = previewElement.getContext('2d')!;
				ctx.clearRect(0, 0, previewElement.width, previewElement.height);
				ctx.beginPath();

				for (let i = 0; i < screenCoords.length - 1; i++) {
					ctx.moveTo(screenCoords[i]!.x, screenCoords[i]!.y);
					ctx.lineTo(screenCoords[i + 1]!.x, screenCoords[i + 1]!.y);
				}
				ctx.moveTo(
					screenCoords[screenCoords.length - 1]!.x,
					screenCoords[screenCoords.length - 1]!.y
				);
				ctx.lineTo(screenPoint.x, screenPoint.y);
				ctx.stroke();
			}
		};

		const handleKeys = (event: KeyboardEvent) => {
			if (points != null)
				if (event.key === 'Enter') {
					this.gitForDrawings.pushStroke(points);
					setTimeout(() => {
						previewElement.remove();
					}, 20);
					points = null;
					screenCoords = null;
				} else if (event.key === 'Escape') {
					screenCoords = null;
					points = null;
					setTimeout(() => {
						previewElement.remove();
					}, 20);
				}
		};

		this.map.on('click', handleMouseDown);
		this.map.on('mousemove', handleMouseMove);

		document.addEventListener('keydown', handleKeys);

		this.activeListeners.set(id, {
			functions: [
				{ func: handleMouseDown, listener: 'click' },
				{ func: handleMouseMove, listener: 'mousemove' }
			]
		});
		this.activeDocumentListeners.set(id, {
			functions: [{ func: handleKeys, listener: 'keydown' }]
		});
	}

	markerRuntime(id: string, runtime: Function) {}

	rectRuntime(id: string, runtime: Function) {}

	circleRuntime(id: string, runtime: Function) {}

	textRuntime(id: string, runtime: Function) {}

	arrowRuntime(id: string, runtime: Function) {
		this.lockMap();

		let startLocation: Array<number> | null = null;
		let startScreenCoord: maplibregl.Point | null = null;
		let previewElement: HTMLCanvasElement | null = null;
		let points: Array<Array<number>> = [];
		const L_head = 20;
		const theta = (30 * Math.PI) / 180;

		const handleMouseClick = (event: maplibregl.MapMouseEvent) => {
			if (startLocation == null) {
				startLocation = [event.lngLat.lng, event.lngLat.lat];

				previewElement = document.createElement('canvas');

				const mapContainer = this.map.getContainer();
				const rect = mapContainer.getBoundingClientRect();

				previewElement.width = mapContainer.offsetWidth;
				previewElement.height = mapContainer.offsetHeight;
				previewElement.style.position = 'fixed';
				previewElement.style.left = rect.left + 'px';
				previewElement.style.top = rect.top + 'px';
				previewElement.style.pointerEvents = 'none';
				previewElement.style.zIndex = '1000';
				previewElement.classList.add('gToolsPreviewOverlay');

				const ctx = previewElement.getContext('2d')!;
				ctx.clearRect(0, 0, previewElement.width, previewElement.height);
				ctx.strokeStyle = drawColor;
				ctx.lineWidth = lineWidth;
				ctx.lineCap = 'round';
				ctx.lineJoin = 'round';

				document.body.append(previewElement);

				startScreenCoord = event.point;
			} else {
				const alpha = Math.atan2(
					event.point.y - startScreenCoord!.y,
					event.point.x - startScreenCoord!.x
				);

				const x_left = event.point.x - L_head * Math.cos(alpha - theta);
				const y_left = event.point.y - L_head * Math.sin(alpha - theta);

				const x_right = event.point.x - L_head * Math.cos(alpha + theta);
				const y_right = event.point.y - L_head * Math.sin(alpha + theta);

				points.push(startLocation);
				points.push([event.lngLat.lng, event.lngLat.lat]);
				let lefthead = this.map.unproject([x_left, y_left]);
				points.push([lefthead.lng, lefthead.lat]);
				points.push([event.lngLat.lng, event.lngLat.lat]);
				let righthead = this.map.unproject([x_right, y_right]);
				points.push([righthead.lng, righthead.lat]);

				this.gitForDrawings.pushStroke(points);
				points = [];
				startLocation = null;
				startScreenCoord = null;
				setTimeout(() => {
					previewElement!.remove();
				}, 20);
			}
		};

		const handleMouseMove = (event: maplibregl.MapMouseEvent) => {
			if (startLocation != null) {
				const ctx = previewElement!.getContext('2d')!;
				ctx.clearRect(0, 0, previewElement!.width, previewElement!.height);
				ctx.beginPath();
				ctx.moveTo(startScreenCoord!.x, startScreenCoord!.y);
				ctx.lineTo(event.point.x, event.point.y);
				ctx.moveTo(event.point.x, event.point.y);

				const alpha = Math.atan2(
					event.point.y - startScreenCoord!.y,
					event.point.x - startScreenCoord!.x
				);

				const x_left = event.point.x - L_head * Math.cos(alpha - theta);
				const y_left = event.point.y - L_head * Math.sin(alpha - theta);

				ctx.lineTo(x_left, y_left);
				ctx.moveTo(event.point.x, event.point.y);

				const x_right = event.point.x - L_head * Math.cos(alpha + theta);
				const y_right = event.point.y - L_head * Math.sin(alpha + theta);
				ctx.lineTo(x_right, y_right);
				ctx.stroke();
			}
		};

		this.map.on('click', handleMouseClick);
		this.map.on('mousemove', handleMouseMove);

		this.activeListeners.set(id, {
			functions: [
				{ func: handleMouseClick, listener: 'click' },
				{ func: handleMouseMove, listener: 'mousemove' }
			]
		});
	}

	createDrawingSegment() {
		const drawSegment = document.createElement('div');
		drawSegment.classList.add('gToolsSegmentDiv');
		this.createTool(
			'freehandTool',
			'Freehand Draw',
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-line-squiggle-icon lucide-line-squiggle"><path d="M7 3.5c5-2 7 2.5 3 4C1.5 10 2 15 5 16c5 2 9-10 14-7s.5 13.5-4 12c-5-2.5.5-11 6-2"/></svg>',
			drawSegment,
			this.freehandRuntime.bind(this),
			false
		);
		this.createTool(
			'pencilTool',
			'Pencil Draw',
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil-line-icon lucide-pencil-line"><path d="M13 21h8"/><path d="m15 5 4 4"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>',
			drawSegment,
			this.pencilRuntime.bind(this),
			false
		);
		this.createTool(
			'multilineTool',
			'Multi-line Draw',
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-activity-icon lucide-activity"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>',
			drawSegment,
			this.multilineRuntime.bind(this),
			false
		);
		this.createTool(
			'arrowTool',
			'Arrow Draw',
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-move-up-icon lucide-move-up"><path d="M8 6L12 2L16 6"/><path d="M12 2V22"/></svg>',
			drawSegment,
			this.arrowRuntime.bind(this),
			false
		);
		this.toolBarDiv.append(drawSegment);
	}

	createShapesSegment() {
		const shapesSegment = document.createElement('div');
		shapesSegment.classList.add('gToolsSegmentDiv');
		this.createTool(
			'markerTool',
			'Add a Marker',
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin-plus-icon lucide-map-pin-plus"><path d="M19.914 11.105A7.298 7.298 0 0 0 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32 32 0 0 0 .824-.738"/><circle cx="12" cy="10" r="3"/><path d="M16 18h6"/><path d="M19 15v6"/></svg>',
			shapesSegment,
			this.markerRuntime.bind(this),
			false
		);
		this.createTool(
			'rectTool',
			'Add a rectangle',
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rectangle-horizontal-icon lucide-rectangle-horizontal"><rect width="20" height="12" x="2" y="6" rx="2"/></svg>',
			shapesSegment,
			this.rectRuntime.bind(this),
			false
		);
		this.createTool(
			'circleTool',
			'Add a circle',
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-icon lucide-circle"><circle cx="12" cy="12" r="10"/></svg>',
			shapesSegment,
			this.circleRuntime.bind(this),
			false
		);
		this.createTool(
			'textTool',
			'Add Text',
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-type-icon lucide-type"><path d="M12 4v16"/><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M9 20h6"/></svg>',
			shapesSegment,
			this.textRuntime.bind(this),
			false
		);
		this.toolBarDiv.append(shapesSegment);
	}

	createCursorSegment() {
		const cursorSegment = document.createElement('div');
		cursorSegment.classList.add('gToolsSegmentDiv');
		this.createTool(
			'cursorTool',
			'Cursor',
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mouse-pointer2-icon lucide-mouse-pointer-2"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/></svg>',
			cursorSegment,
			this.cursorRuntime.bind(this),
			true
		);
		this.toolBarDiv.append(cursorSegment);
	}

	createUndoRedoSegment() {
		const URSegment = document.createElement('div');
		URSegment.classList.add('gToolsSegmentDiv');
		// redo
		const redoIconDiv = document.createElement('div');
		redoIconDiv.classList.add('gToolsIcon');
		redoIconDiv.addEventListener('click', (event) => {
			this.gitForDrawings.redoAction();
		});
		const redoIcon = document.createElement('div');
		redoIcon.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-redo-icon lucide-redo"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>';
		redoIconDiv.append(redoIcon);
		URSegment.append(redoIconDiv);
		// undo
		const undoIconDiv = document.createElement('div');
		undoIconDiv.classList.add('gToolsIcon');
		undoIconDiv.addEventListener('click', (event) => {
			this.gitForDrawings.undoLastAction();
		});
		const undoIcon = document.createElement('div');
		undoIcon.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-undo-icon lucide-undo"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>';
		undoIconDiv.append(undoIcon);
		URSegment.append(undoIconDiv);
		this.toolBarDiv.append(URSegment);
	}

	saveDrawings() {
		return this.gitForDrawings.saveToObject();
	}

	loadDrawings(drawings: Feature[]) {
		this.gitForDrawings.loadFeatures(drawings);
	}

	close() {
		this.toolBarDiv.remove();
		this._clearSelection();
		this.gitForDrawings.deInit();
	}

	initToolbar() {
		this.toolBarDiv = document.createElement('div');
		this.toolBarDiv.id = 'gToolsBarDiv';
		this.createCursorSegment();
		this.createDrawingSegment();
		this.createShapesSegment();
		this.createUndoRedoSegment();
		document.body.append(this.toolBarDiv);
	}
}
