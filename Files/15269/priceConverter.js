function numberToPrice (price, thousands, decimals) {
    
    price = parseInt(price);
    var decimalValue = (price % 100).toString();
    if (decimalValue.length<2) decimalValue = "0" + decimalValue;
    var floorValue = Math.floor(price / 100);
    var finalValue = decimals + decimalValue;
    if (floorValue > 0) {
        floorValue = floorValue.toString();
        var floorValueLength = floorValue.length;
        var floorValueSteps = Math.floor ( (floorValueLength-1) / 3);
        var firstime = true;

        for (var i=0; i<= floorValueSteps; i++) {
            if (!firstime) finalValue = thousands + finalValue;
            finalValue = floorValue.substring( (floorValueLength - 3*(i+1)), ( floorValueLength - 3*i ) ) + finalValue;
            firstime = false;
        }
    }
    else finalValue = "0" + finalValue;
    return finalValue;  
}
    
function numberToPriceByCountry (price, country) {

    var thousands = '.',  decimals = ',';
    if  (country && country == 'uk') {
        thousands = ',';
        decimals = '.';
    }
    
    return numberToPrice (price, thousands, decimals);
}

function priceToNumber (text) {
    
    if (!text) return null;
    var exp = new RegExp('[^\\d]', 'gi');
    exp.lastIndex = 0;
    var onlyNumber = text.replace(exp, '');
    var value =  parseFloat (onlyNumber);
    
    if (typeof (value) == 'undefined') return null;
    return value;
    
}