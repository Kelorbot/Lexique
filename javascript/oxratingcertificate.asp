
(function OxSiteRating() {
	var _P = this;
	var m_bJSonToAdd = true;
	this.m_html = null;
	this.m_lookingForID = "OxSiteRating";
	this.encodeHtml = function (html) { return html.replace(/\'\"/g, function (v) { return '\\' + v; }); };
	this.checkEnable = function () {
		var callBack = (typeof OxSiteRatingFctCallBack == "function");
		if (!window.OxSiteRatingDisable && !callBack) _P.findAndReplace();
		if (callBack) OxSiteRatingFctCallBack(_P.m_html);
	};
	this.findAndReplace = function () {
		var nd;
		if (nd = document.getElementById(_P.m_lookingForID)) {
			nd.innerHTML = _P.m_html;
			if ( m_bJSonToAdd ) this.addJSonLD();
			}
		if (!nd) {
			if (nd = document.getElementsByTagName('div')) {
				for (var i = 0, l = nd.length; i < l; i++) {
					if (nd[i].className == "OxSiteRating") {
						nd[i].innerHTML = _P.m_html;
						if ( m_bJSonToAdd ) this.addJSonLD();
					}
				}
			};
		};
	};
	this.addEvent = function (obj, evName, fct) {
		if(obj.addEventListener) {
			obj.addEventListener(evName, fct, false);
		} else {
			obj.attachEvent("on" + evName, fct);
		};
	};
	this.init = function () {
		var ndList;
		_P.m_html = _P.encodeHtml("<div class=\"OxSiteRatingCert\" style=\"width:150px; background:#FFFFFF; text-align:center; padding:6px 0px 0 6px 0; margin:2px 0;\" ><a href=\"https://www.shopping-satisfaction.com/OxSiteRating.asp?RatedAccID=16323&PGFlngID=0\" target=\"Shopping-Satisfaction\" aria-label=\"Shopping Satisfaction\"><img src=\"/Images/Rating/Shopping-Satisfaction-Logo.png\" alt=\"Shopping Satisfaction\" width=\"130\"></a><div class=\"OxRatingBk\"><div class=\"OxRatingGauge\" style=\"width:100%;\"><a class=\"PBLink\" href=\"https://www.shopping-satisfaction.com/OxSiteRating.asp?RatedAccID=16323&PGFlngID=0\" target=\"Shopping-Satisfaction\" aria-label=\"Shopping Satisfaction\"><img class=\"OxReviewBar\" src=\"../Images/Transparent.gif\" alt=\"Shopping Satisfaction\" /></a></div></div><div class=\"OxReviewCount\"><a class=\"PBLink\" href=\"https://www.shopping-satisfaction.com/OxSiteRating.asp?RatedAccID=16323&PGFlngID=0\" target=\"Shopping-Satisfaction\" aria-label=\"Shopping Satisfaction\">(36)</a></div></div>");
		window.OxSiteRatingHTML= _P.m_html;
		if ((ndList = document.getElementsByTagName("body")) && ndList.length > 0) _P.checkEnable();
		else {
			_P.addEvent(document, "DOMContentLoaded", _P.checkEnable);
			_P.addEvent(window, "load", _P.checkEnable);
		};
	};
	this.addJSonLD = function () {
		var el = document.createElement('script');
		el.type = 'application/ld+json';
		el.text = "{\"@context\":\"http:\/\/schema.org\/\",\"@type\":\"Organization\",\"name\":\"www.masquesdecatch.com\",\"url\":\"https:\/\/www.masquesdecatch.com\",\"aggregateRating\":{\"@type\":\"AggregateRating\",\"ratingCount\":\"36\",\"ratingValue\":\"5\",\"bestRating\":\"5.0\",\"worstRating\":\"1.0\"}}";
		document.getElementsByTagName('head')[0].appendChild(el);
		m_bJSonToAdd = false;
	};
	_P.init();
})();