define([
  "esri/Map",
  "esri/views/MapView",
  "esri/widgets/LayerList",
  "esri/widgets/Legend",
], function (Map, MapView, LayerList, Legend) {
  function createMap() {
    const map = new Map({
      basemap: "streets-navigation-vector",
    });

    const view = new MapView({
      container: "viewDiv",
      map: map,
      center: [-74.29, 4.57], //centered in Colombia
      zoom: 6,
      padding: {
        left: 49,
      },
    });
    view.ui.move("zoom", "bottom-right");

    const layerList = new LayerList({
      view,
      dragEnabled: true,
      visibilityAppearance: "checkbox",
      container: "layers-container",
      listItemCreatedFunction: defineActions,
    });

    const legend = new Legend({
      view,
      container: "legend-container",
    });

    function defineActions(event) {
      const item = event.item;
      item.actionsSections = [
        [
          {
            title: "Eliminar",
            icon: "trash",
            id: "delete-layer",
          },
        ],
      ];
    }

    layerList.on("trigger-action", async (event) => {
      // Capture the action id.
      const id = event.action.id;
      const layer = event.item.layer;
      if (id === "delete-layer") {
        map.remove(layer);
      }
    });

    view.when(() => {
      let activeWidget;

      const handleActionBarClick = ({ target }) => {
        if (target.tagName !== "CALCITE-ACTION") {
          return;
        }

        if (activeWidget) {
          document.querySelector(
            `[data-action-id=${activeWidget}]`
          ).active = false;
          document.querySelector(
            `[data-panel-id=${activeWidget}]`
          ).hidden = true;
        }

        const nextWidget = target.dataset.actionId;
        if (nextWidget !== activeWidget) {
          document.querySelector(
            `[data-action-id=${nextWidget}]`
          ).active = true;
          document.querySelector(
            `[data-panel-id=${nextWidget}]`
          ).hidden = false;
          activeWidget = nextWidget;
        } else {
          activeWidget = null;
        }
      };

      document
        .querySelector("calcite-action-bar")
        .addEventListener("click", handleActionBarClick);
      let actionBarExpanded = false;

      document.addEventListener("calciteActionBarToggle", (event) => {
        actionBarExpanded = !actionBarExpanded;
        view.padding = {
          left: actionBarExpanded ? 135 : 49,
        };
      });
    });
    return [map, view];
  }

  return { createMap };
});
