export function roundCoords (coordArray, decimals) {

    const [x, y] = coordArray;

    if (decimals === 0) {
        return [Math.round(x), Math.round(y)]
    }

    const multiplier = 10 ** decimals;

    const roundedX = Math.round(x * multiplier) / multiplier;
    const roundedY = Math.round(y * multiplier) / multiplier;


    return [roundedX, roundedY];
}