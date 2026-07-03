function getCookie(sName) {


    if (window.sessionStorage && sessionStorage.getItem(sName) != null) {
        var getLocal = sessionStorage.getItem(sName);
        return getLocal;
    }

    var oRegex = new RegExp("(?:; )?" + sName + "=([^;]*);?");

    if (oRegex.test(document.cookie)) {
        return unescape(RegExp["$1"]);
    } else {
        return null;
    }
}

function setCookie(sName, value, min) {

    if (window.sessionStorage) {

        try {
            sessionStorage.setItem(sName, value);
        }
        catch (e) {
            window.console && console.log('storage disabled');
        }

        return;
    }

    var expires;
    if (min) {
        var date = new Date();
        date.setTime(date.getTime() + (min * 60 * 1000));
        expires = "; expires=" + date.toGMTString();
    }
    else
        expires = "";
    document.cookie = sName + "=" + escape(value) + expires + "; path=/";
}

function eraseCookie(sName) {

    if (window.sessionStorage) {
        sessionStorage.removeItem(sName);
        return null;
    }

    setCookie(sName, "", -1);
    return null;
}


function setStorage(sName, value) {
    if (window.sessionStorage || JSON.stringify) {
        if (typeof (value) == 'object')
            value = JSON.stringify(value);
        sessionStorage.setItem(sName, value);
        return true;
    }
    return false;
}

function getStorage(sName) {
    if (window.sessionStorage || JSON.stringify) {
        var getLocal = sessionStorage.getItem(sName);
        var reg = (/{.+}/gi).exec(getLocal);
        if (reg)
            return JSON.parse(getLocal);
        return getLocal;
    }
    return false;
}