export function getSavedPointStyle(name) {
  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: 7,
      fill: new ol.style.Fill({
        color: "#8903ff",
      }),
      stroke: new ol.style.Stroke({
        color: "white",
        width: 3,
      }),
    }),
    text: new ol.style.Text({
      text: name,
      font: "bold 12px sans-serif",
      fill: new ol.style.Fill({
        color: "black",
      }),
      stroke: new ol.style.Stroke({ color: '#fff', width: 3 }),
      offsetY: -15,
    }),
  });
}

export function getSelectedPointStyle(name) {
  const baseStyle = getSavedPointStyle(name);
  baseStyle.getImage().setStroke(
    new ol.style.Stroke({
      color: "blue",
      width: 4,
    }),
  );
  return baseStyle;
}