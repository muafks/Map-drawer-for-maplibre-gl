import './geodraw.css';
import * as maplibregl from 'maplibre-gl';
interface Feature {
    type: 'Feature';
    geometry: {
        type: 'LineString';
        coordinates: Array<Array<number>>;
    };
    properties: {};
}
declare class gitDrawings {
    map: maplibregl.Map;
    geojsonDrawings: Array<Feature>;
    undoHistory: Array<Feature>;
    constructor(map: maplibregl.Map);
    init(): void;
    deInit(): void;
    updateLayerColor(color: string): void;
    updateSourceLayer(): void;
    undoLastAction(): void;
    redoAction(): void;
    pushStroke(coordinates: Array<Array<number>>): void;
    saveToObject(): {
        drawings: Feature[];
    };
    loadFeatures(features: Feature[]): void;
}
declare class DrawTools {
    map: maplibregl.Map;
    toolBarDiv: HTMLElement;
    toolbarStates: Map<string, boolean>;
    activeListeners: Map<string, {
        functions: Array<{
            func: Function;
            listener: string;
        }>;
    }>;
    activeDocumentListeners: Map<string, {
        functions: Array<{
            func: Function;
            listener: string;
        }>;
    }>;
    gitForDrawings: gitDrawings;
    constructor(map: maplibregl.Map);
    _clearSelection(): void;
    _selectTool(id: string, toolDiv: HTMLElement | HTMLDivElement): void;
    createTool(id: string, name: string, icon: string, segment: HTMLDivElement | HTMLElement, runtime: Function, startSelected?: boolean): void;
    lockMap(): void;
    unlockMap(): void;
    cursorRuntime(id: string, runtime: Function): void;
    freehandRuntime(id: string, runtime: Function): void;
    pencilRuntime(id: string, runtime: Function): void;
    multilineRuntime(id: string, runtime: Function): void;
    markerRuntime(id: string, runtime: Function): void;
    rectRuntime(id: string, runtime: Function): void;
    circleRuntime(id: string, runtime: Function): void;
    textRuntime(id: string, runtime: Function): void;
    arrowRuntime(id: string, runtime: Function): void;
    createDrawingSegment(): void;
    createShapesSegment(): void;
    createCursorSegment(): void;
    createUndoRedoSegment(): void;
    saveDrawings(): {
        drawings: Feature[];
    };
    loadDrawings(drawings: Feature[]): void;
    close(): void;
    initToolbar(): void;
}
export default DrawTools;
//# sourceMappingURL=index.d.ts.map