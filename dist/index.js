// src/geodraw.css
var css = `#gToolsBarDiv {
    position: fixed;
    top: 10px;
    left: 10px;
    display: flex;
    flex-direction: column;
    width: fit-content;
    height: fit-content;
    /* align-items: center; */
    z-index: 13;
    gap: 10px;
}

.gToolsSegmentDiv {
    display: flex;
    width: fit-content;
    height: fit-content;
    flex-direction: column;
    background-color: whitesmoke;
    border-radius: 10px;
    gap: 5px;
    z-index: 13;
    box-sizing: border-box;
    padding: 4px;
    align-items: center;
}

.gToolsIcon {
    padding: 5px;
    border-radius: 10px;
    width: fit-content;
    height: fit-content;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.gToolsIcon:hover {
    background-color: #c6c6c6;
}

.gToolsSelected {
    background-color: #c6c6c6 !important;
}

.gToolsPreviewOverlay {
    display: flex;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    position: fixed;
    top: 0px;
    left: 0px;
}`;
var style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);

// src/index.ts
import "maplibre-gl";
//# sourceMappingURL=index.js.map
