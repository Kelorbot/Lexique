/***************************Panier dynamique V 5.0 *******************************/
function OxAddToCart( nProductID, strURLParams ) {
    if (dc.strURLParamsUpdate) strURLParams = dc.strURLParamsUpdate (nProductID, strURLParams);
    var answer= dc.addToCart( nProductID, strURLParams);
    return answer;
}

//variables et valeurs par défaut
var dc = {};
dc.timeToOpen = 200;
dc.timeToClose = 500;
dc.openingSpeed = 400;
dc.autoCloseDelay = 1000;
dc.maxListHeight = 250;
dc.defaultImg = 'Files/0/oxa-cart-5-96px.png';
dc.imgReduction = 1.5;
dc.defaultImgHSize = 96;
dc.defaultImgWSize = 96;
dc.titleProdLength = 25;

dc.btnviewCartText = /\d+/gi;
dc.returnCartMainId = 'shopcartreturn';
dc.returnCartBodyId = 'shopcartbody';
dc.returnCartContainerId = 'shopcartcontainer';
dc.returnCartPreloadId = 'shopcartpreload';
dc.miniCartExpandClass = 'miniCartExpand';
dc.hoverClass = 'cartActive';
dc.mainTblPopupCartId = 'blockCart';
dc.returnButton = '#returnShopping';
dc.oldCartButton = '#btnviewcart span';
dc.require = ["Files/15269/tagExtractor.js", "Files/15269/priceConverter.js", "Files/15269/ajaxScheduler.js"];
dc.exclusionList = '.scshopcart, .scorderform, .scshipform , .scpaymentform, .scconfirmform';
dc.shopCartUrl = '/PBSCProduct.asp?ItmID=';

//fonctionnalités
dc.openMode = false;
dc.hoverMode = false;
dc.animateMode = false;
dc.popupId = false ;

//points insertions 
dc.onComplete = null; // fonction déclenchée apr?s toute MAJ du DOM par le panier
dc.strURLParamsUpdate = null; // fonction (nProductID, strURLParams) déclenchée avant l'exécution du panier : doit retourner le strURLParams modifié 
  
//récupération des autres scripts
dc.scriptDownloader = function () {
    dc.testLoad = 0;
    dc.testParse = dc.require.length + 1;
    for (var i=0, l = dc.require.length; i<l; i++) {
        var test =  $('script[src*="'+ dc.require[i] + '"]');
        if (test.length) {
            dc.testParse--;
            continue;
        } 
        dc.createScript (dc.require[i]);
    }
    
    
    dc.scriptOnLoad ();
}

//récupération des autres scripts
dc.strString = function (string) {
    if(window.console) console.log(string, dc.titleProdLength) 
   return string.substring('0',dc.titleProdLength) + '...';
}

dc.createScript = function (url) {
    var script = document.createElement('script');
    if(script.addEventListener) {
        script.addEventListener("load", dc.scriptOnLoad, false);
    } 
    else if(script.readyState) {
        
        script.onreadystatechange = function () {
            console.log(this.readyState)
            if (this.readyState == 'loaded' || this.readyState == 'complete') dc.scriptOnLoad();
        }
    }
    script.src = url;
    
    script.type = 'text/javascript';
    document.body.appendChild (script);
}

dc.scriptOnLoad = function () {
     
    
    dc.testLoad ++;
    
     if(window.console) console.log(' dc.testLoad : ',  dc.testLoad, '   dc.testParse : ',   dc.testParse);
    
    if (dc.testParse != dc.testLoad) return;
    dc.exec(); 
}

//fonction principale
dc.exec = function () {
    
    if(window.console) console.log('Démarre du Script');
    
    //création des variables
    dc.newLines = [];
    dc.clickNumber = 0;
    
    //restructuration HTML mini panier
    dc.cartItemTmplBlock = dc.cartItemTmpl.detach();
    dc.miniCartId = $(dc.miniCartZone);
    $(dc.miniCartDetail).wrapInner('<div class="' + dc.miniCartExpandClass + '"/>');
    dc.miniCartDetailId = $(dc.miniCartDetail + ' > div');
    dc.miniCartDetailId.hide();
    dc.miniCartTag = dc.miniCartId.get(0);
    //tests de validité
    if (!dc.miniCartId.length || !dc.miniCartDetailId.length) return;
    
    
    
    if(window.console) console.log('Démarre du Script 2');
    //détection des tags panier
    dc.cartQtyList = new tagDetection ();
    dc.replaceTag (/#cartQty#/gi, dc.miniCartZone, dc.cartQtyList);
    dc.cartTotalList = new tagDetection ();
    dc.replaceTag (/#cartTotal#/gi, dc.miniCartZone, dc.cartTotalList);

    dc.btnviewcartQty = new tagDetection ();
    dc.replaceTag (dc.btnviewCartText, '#btnviewcart', dc.btnviewcartQty);

    //mise ? jour initiale
    dc.updateMiniartZone ();
    
    //affichage du mini panier
    $(dc.dynamicCart).show();
    
    //gestion deu clic
    dc.miniCartId.click(dc.showCartPage);
    
    //activation du mode ouvert/fermé
    dc.allowOpen = ($(dc.exclusionList).length)? false : true;
      
    //détection du hover
    $(dc.dynamicCart).hover( function(){
        dc.miniCartTag.className = dc.hoverClass;
        clearTimeout (dc.closing);
        if (dc.isHover) return;
        dc.isHover = true;
        dc.opening = setTimeout ( dc.updateDetail, dc.timeToOpen);  
    }).mouseleave( function(){
        dc.miniCartTag.className =  "";
        clearTimeout (dc.opening);
        dc.closing = setTimeout ( dc.closeDetail , dc.timeToClose);
    });
    
    if (dc.onComplete) dc.onComplete ();
}

//mise ? jour du mini Panier
dc.updateMiniartZone = function () {
    dc.updateListValue (dc.btnviewcartQty, dc.cartqtytotal);
    dc.updateListValue (dc.cartQtyList, dc.cartqtytotal);
    dc.updateListValue (dc.cartTotalList, dc.currency.mainFormat.replace ('#', numberToPrice (Math.ceil ( parseFloat( dc.grandtotalprice*100 ) ) , dc.currency.thousandsSep, dc.currency.decSep) ) );  
}

//renvoi vers la page du panier
dc.showCartPage = function () {
    window.location.replace ("/PBShoppingCart.asp")
}

//remplacement d'un tag
dc.replaceTag = function (regTag, source, varName) {
    varName.regTag = regTag;
    varName.source = source;
    varName.tagType = 'span';
    varName.exec ();   
}

//mise ? jour d'une liste de tags dans le dom
dc.updateListValue = function (tag, value) {
    for (var key in tag.nodeList) {
        if (!isNaN(key)) {
            tag.nodeList[key].node.innerHTML = value;
        }
    }
}

//gestion de la mise ? jour du panier
dc.updateDetail = function () {
    if (!dc.cartContent) {
        $.ajax({
            url: 'PBShoppingCart.asp?ajaxmode=1',
            cache: false,
            dataType:'json',
            success: function(answer) {
                dc.cartContent= answer;    
                  dc.showReduceCart();
                dc.buildDetail (function () {
                    if (dc.onComplete) dc.onComplete ();
                    dc.openDetail ();
                });
                
            }
        });
    } else { dc.openDetail ();   dc.showReduceCart(); }
}

// Construction de la liste du détail
dc.buildDetail = function (onDone) {
    
    //MAJ miniCartZone
    dc.grandtotalprice = dc.cartContent.cartFeatures.subTotalNet || 0 ;
    dc.cartqtytotal = dc.cartContent.cartqtytotal;
    if (!dc.cartqtytotal) {
        dc.cartqtytotal=0;
        dc.grandtotalprice=0;
    }
    dc.updateMiniartZone ();
        
    if (!dc.cartqtytotal) return;
    var imgNumber = 1;
    var imgCheck = 0;
    
    //MAJ du détail  
    $.each(dc.cartContent.products, function(key, value) {

  
        if (!dc.newLines[key]) {
            dc.newLines[key] = {};
            dc.newLines[key].node = dc.cartItemTmplBlock.clone();
            
            dc.newLines[key].cartItemName = new tagDetection ();
            dc.newLines[key].cartItemQty = new tagDetection ();
            dc.newLines[key].cartItemPrice = new tagDetection ();
            dc.newLines[key].cartItemImg = new tagDetection ();
                
            dc.replaceTag (/#cartItemName#/gi, dc.newLines[key].node,  dc.newLines[key].cartItemName);  
            if(window.console) console.log( dc.newLines[key].cartItemName.source.text());
            
            dc.replaceTag (/#cartItemQty#/gi, dc.newLines[key].node,  dc.newLines[key].cartItemQty);  
            dc.replaceTag (/#cartItemPrice#/gi, dc.newLines[key].node,  dc.newLines[key].cartItemPrice);   
            dc.replaceTag (/#cartItemImg#/gi, dc.newLines[key].node,  dc.newLines[key].cartItemImg);  

            dc.cartItemHeader.after (dc.newLines[key].node);
        }
           
        dc.updateListValue (dc.newLines[key].cartItemPrice, dc.currency.mainFormat.replace ( '#', numberToPrice ( Math.ceil ( parseFloat( value.itemPriceNet*100 ) ), dc.currency.thousandsSep, dc.currency.decSep ) ) ); 
        
        // gestion du temps de chargement des visuels
        if (value.itemImgFile) {
            imgNumber++;
            var imgTemp = document.createElement('img');
            imgTemp.onload = getHeight;
            imgTemp.src = value.itemImgFile ;
            dc.updateListValue (dc.newLines[key].cartItemImg, '<a href="' + dc.shopCartUrl + value.itemID + '"><img class="miniCarttImg" src="' + value.itemImgFile + '"/></a>'); 
        }
        dc.updateListValue (dc.newLines[key].cartItemName, '<a class="PBLink" href="' + dc.shopCartUrl + value.itemID + '"><span class="PBMainTxt">' + dc.strString(value.itemName) + '</span></a>'); 
        
        var tempText = '<span class="PBQty">' + value.itemQuantity + '</span>';
        tempText += '<a class="PBBtnStd" href="javascript:dc.updateQty(' + key + ', ' + 1 + ');">(+)</a>' ;
        tempText += '<a class="PBBtnStd"  href="javascript:dc.updateQty(' + key + ', ' + -1 + ');">(-)</a>' ;
        dc.updateListValue (dc.newLines[key].cartItemQty, tempText); 
        
    });
    
    getHeight ();
    
    function getHeight () {
        imgCheck ++;
        if (imgCheck != imgNumber ) return;
        
        //MAj dimensions
        dc.miniCartHeight = dc.miniCartDetailId.outerHeight();
        if (dc.maxListHeight && dc.miniCartHeight > dc.maxListHeight) {
            dc.miniCartHeight = dc.maxListHeight;
            dc.miniCartScroll = true;
        }  
        //callback
        if (onDone) onDone();
    }
    
}


dc.showReduceCart = function(){    
    
       
    if(window.console) console.log('dc.cartContent', dc.cartContent,
    'reductionType',dc.cartContent.cartFeatures.reductionType,
    'reductionAmount',dc.cartContent.cartFeatures.reductionAmount,
    'totalBeforeReduction',dc.cartContent.cartFeatures.totalBeforeReduction,
    'subTotalNet',dc.cartContent.cartFeatures.subTotalNet

);    
    
    dc.reduceCart = dc.cartContent.cartFeatures.totalBeforeReduction - dc.cartContent.cartFeatures.subTotalNet;
    if(window.console) console.log(dc.reduceCart);
    
    dc.reduceCartTag = new tagDetection ();
     
    dc.replaceTag (/ #reduceCart#/gi, dc.reduceCart, dc.reduceCartTag);  
    
}


//Ouverture  de la liste du panier
dc.openDetail = function (comment) {
    if (!dc.hoverMode || !dc.allowOpen || !dc.cartqtytotal || dc.isOpen) return;
    dc.isOpen = true;
    if (dc.miniCartScroll) dc.miniCartDetailId.css('overflow-y', 'auto');
     
    if (comment == 'quick')  {
        dc.miniCartDetailId.css('height', dc.miniCartHeight + 'px').show();
    }
    else { 
        dc.miniCartDetailId
        .css('height', 0)
        .show()
        .animate({
            'height': dc.miniCartHeight
        }, {
            duration : dc.openingSpeed,
            complete : function () {
                if ( (comment == 'andClose' ) && !dc.isHover) {
                    dc.closing = setTimeout (function () {
                        dc.closeDetail();
                    }, dc.autoCloseDelay)      
                }
            }
        });
    }
    
   
    
}

//fermeture de la liste du panier
dc.closeDetail = function () {
    dc.isHover = false;
    dc.isOpen = false;
    dc.miniCartDetailId.animate({
        'height': 0
    }, {
        duration : dc.openingSpeed,
        complete : function () {
            $(this)
            .hide()
            .css({
                'height' : 'auto',
                'overflow-y' : 'hidden'
            });
        }
    });
}

//ajout au panier 
dc.addToCart =  function (nProductID, strURLParams) {
    if (!dc.popupId && !dc.animateMode) return false;
    
    dc.clickNumber++;
    
    $.ajax({
        url: 'PBShoppingCart.asp?AjaxMode=1&'+strURLParams,
        cache: false,
        dataType:'json',
        success: function(answer) {
            dc.cartContent= answer;               
            if (dc.animateMode) dc.animateCart (nProductID);
            if (dc.popupId) dc.buildDetail (function () {
                dc.popupCart (nProductID);
            }); 
        }
    });
    return true;
}

//Maj des quantités
dc.updateQty =  function (listId, qty) {
    var urlParams = 'ActionID=1';
    var tempValue;
    var todestroy = false;
    $.each(dc.cartContent.products, function(key, value) {
        tempValue = (key == listId)?  value.itemQuantity + qty :  value.itemQuantity;
        if (tempValue <=0 ) {
            dc.newLines[key].node.remove();
            todestroy = true;
        }
        urlParams += '&QTY' + key + '=' + tempValue; 
      
    });

    if (todestroy) dc.clearList ();
    
    $.ajax({
        url: 'PBShoppingCart.asp?AjaxMode=1',
        cache: false,
        type: 'POST',
        dataType:'json',
        data : encodeURI(urlParams),
        success: function(answer) {
            dc.cartContent= answer;   
            dc.buildDetail ();
        }
    });
    
}

//suppression des noeuds du minipanier
dc.clearList = function () {
    for (var key in dc.newLines) {
        if (!isNaN(key)) {
            dc.newLines[key].node.remove();
        }
    }
    dc.newLines = {};
}

//addToCart version Popup 
dc.popupCart = function (nProductID) {
    dc.addHTMLStructure();

    if (!dc.htmlPopupTemplate) {
        
        var targetPopUp = $('#' + dc.mainTblPopupCartId);
                
        if(targetPopUp.length){
            dc.htmlPopUp = targetPopUp.parent().html();
            dc.htmlPopupTemplate = dc.htmlPopUp; 
            dc.htmlPopuprenderer (nProductID);
            if (dc.onComplete) dc.onComplete ();
            return;
        }
        
        $.ajax({
            url:  'ws/wsGetWebBlock.asp?WBID='+dc.popupId,
            cache: false,
            dataType:'json',
            success: function(answer) {
                if (answer.error)  {
                    if (window.console) console.log ('Error : Wrong popupCartTmpl ID');
                    dc.returnToSite();
                    return;
                }
                
                if(window.console) console.log(answer.htmlContent);
                dc.htmlPopupTemplate = answer.htmlContent; 
                dc.htmlPopuprenderer (nProductID);
                if (dc.onComplete) dc.onComplete ();
            }
        });
    } else {
        dc.htmlPopuprenderer ();
        if (dc.onComplete) dc.onComplete ();
    }
}

// render de la popup
dc.htmlPopuprenderer = function (nProductID) {

    var htmlModel=dc.htmlPopupTemplate;
    
    dc.totalSubAmounnt = (dc.cartContent.currencies.scndryFormat && dc.cartContent.currencies.scndryRate)? dc.cartContent.currencies.scndryFormat.replace ('#', numberToPrice ( Math.round ( parseFloat(dc.cartContent.cartsubtotalnet) * parseFloat(dc.cartContent.currencies.scndryRate) ), dc.cartContent.currencies.thousandsSep, dc.cartContent.currencies.decSep) ) : null;

    var pdtTitle = null;
    var pdtImg = null;
    var pdtPrice = null;
    var pdtScndryPrice = null;
        
    $.each(dc.cartContent.products, function(key, val) {
        if (val.itemID != nProductID) return;
        pdtTitle = val.itemName;
        if (val.itemImgFile) pdtImg = '<img bordel=0 src="' + val.itemImgFile + '">';
        if ( val.itemPriceNet ) pdtPrice = dc.cartContent.currencies.mainFormat.replace ('#', numberToPrice ( Math.ceil ( parseFloat(val.itemPriceNet) * 100 ), dc.cartContent.currencies.thousandsSep, dc.cartContent.currencies.decSep) );
        if ( val.itemPriceNet && dc.cartContent.scndryRate && dc.cartContent.currencies.scndryFormat) pdtScndryPrice = dc.cartContent.currencies.scndryFormat.replace ('#', numberToPrice ( Math.round ( parseFloat(val.itemPriceNet) * 100 * parseFloat(dc.cartContent.currencies.scndryRate) ), dc.cartContent.currencies.thousandsSep, dc.cartContent.currencies.decSep) );
    });
        
    htmlModel = dc.replaceFromTemplate (htmlModel, '#ADDEDITEMS#', dc.cartContent.result, true );
    htmlModel = dc.replaceFromTemplate (htmlModel, '#TOTALITEMS#', dc.cartqtytotal, true );
    htmlModel = dc.replaceFromTemplate (htmlModel, '#CARTAMOUNT#',  dc.currency.mainFormat.replace ('#', numberToPrice (Math.ceil ( parseFloat( dc.grandtotalprice *100 ) ) , dc.currency.thousandsSep, dc.currency.decSep) ) );
    htmlModel = dc.replaceFromTemplate (htmlModel, '#SCNDRYCARTAMOUNT#', dc.totalSubAmounnt);
    htmlModel = dc.replaceFromTemplate (htmlModel, '#PDTTITLE#', pdtTitle);
    htmlModel = dc.replaceFromTemplate (htmlModel, '#PDTPRICE#', pdtPrice);
    htmlModel = dc.replaceFromTemplate (htmlModel, '#SCNDRYPDTPRICE#', pdtScndryPrice);
    htmlModel = dc.replaceFromTemplate (htmlModel, '#PDTIMG#', pdtImg);
    dc.returnCartContainer.innerHTML = htmlModel;
    $('> table', dc.returnCartContainer)
    .attr('id', dc.mainTblPopupCartId)
    .removeAttr('width')
    .click(function (e) {
        e.stopPropagation();
    });
    //Gestion des clics
    $(dc.returnButton).attr('href','javascript:void(0);');
    $(dc.returnButton).click( dc.returnToSite );       
    $(dc.returnCartContainer).click (dc.returnToSite );
} 

//Remplacement dynamique des tags
dc.replaceFromTemplate = function (htmlModel, tag, value, recursive) {

    if (recursive) {
        if (!value) value = 0;
        value = parseInt(value);
        var reg = {
            expression:new RegExp(tag+"\\s*\\{\\s*\\[([^\\}|\\]]*)\\]\\s*\\[([^\\}|\\]]*)\\]\\s*\\[([^\\}|\\]]*)\\]\\}", "gi"),
            tagValue:new RegExp("#VALUE#", "gi")
        }
        var doResult=reg.expression.exec(htmlModel);
        if (!doResult) return htmlModel;

        var idValue = (value>2)? 3 : value+1,
        newHTML=doResult[idValue].replace(reg.tagValue, value);
        htmlModel=htmlModel.replace(reg.expression,newHTML);  
    } else {
        var tagValue = new RegExp(tag, "gi");
        if (!value) value='';
        htmlModel=htmlModel.replace(tagValue, value);
    }
    return htmlModel;
}

//ajout structure HTML popup
dc.addHTMLStructure = function () {
    
    if (!dc.popupMainContainer) {
        
        dc.returnCartMain = document.createElement("div");
        dc.returnCartMain.id = dc.returnCartMainId;
    
        dc.returnCartBody = document.createElement("div");
        dc.returnCartBody.id = dc.returnCartBodyId;
        dc.returnCartBody.style.height = $(document).height();
        dc.returnCartContainer = document.createElement("div");
        dc.returnCartContainer.id = dc.returnCartContainerId;
    
        dc.returnCartMain.appendChild( dc.returnCartBody );   
        dc.returnCartMain.appendChild( dc.returnCartContainer );  
        document.body.appendChild (dc.returnCartMain);
    }
    
    dc.returnCartBody.height = $(document).height();
    
    dc.returnCartMain.style.display = 'block';
    
    dc.returnCartPreload = document.createElement("div");
    dc.returnCartPreload.id = dc.returnCartPreloadId;
    dc.returnCartContainer.appendChild( dc.returnCartPreload );  
    dc.returnCartContainer.style.top = $(window).scrollTop();

}
// addToCart version animée
dc.animateCart = function (nProductID) {

    var isThereImages = false;

    function spotImage (referer, element, only, defaultZone) {
        /* referer : la zone du produit
               element : l'image du produit - null ou classe ? trouver
               only : ne doit pas s'appliquer si une image a déj?  été trouvée - true ou false
               defaultZone : point de référence si le produit n'a pas d'image
            */
        if (isThereImages && only) return;

        var localObject = "$(this)";
        if (element) localObject += ".find('"+element+"')";
        localObject +=".eq(0)";

        referer.each(function () {
            var imgRelated = new dc.moveToCart(eval(localObject));
            imgRelated.onDone = function () { 
                dc.clickNumber--;
                if (dc.clickNumber ==0 )  {
                    dc.buildDetail ( function () {
                        if (dc.onComplete) dc.onComplete ();
                        if (dc.openMode) dc.openDetail ('andClose');
                    })
                    
                }
            }
 
            if ( imgRelated.moveInCart() ) {
                isThereImages=true ;
            } else {
                localObject = "$(this).find('"+defaultZone+"').eq(0)";
                var btnRelated = new dc.moveToCart( eval(localObject), dc.defaultImg );
                btnRelated.height = dc.defaultImgHSize;
                btnRelated.width = dc.defaultImgSWize;
                btnRelated.onDone = function () { 
                    dc.clickNumber--;
                    if (dc.clickNumber ==0 )  {
                        
                        dc.buildDetail (function () {
                            if (dc.onComplete) dc.onComplete ();
                            if (dc.openMode) dc.openDetail ('andClose');
                        });
                    }
                }
                if ( btnRelated.moveInCart() ) {
                    isThereImages=true ;
                }
            }
        });
    }

    var original = [
    {
        referer : "$('.sectiondataarea').has('.itemdetail a.btnaddtocart[href*=\"AddToCart(#productID#\"]')",
        element : '.imgmain',
        only : true,
        defaultZone : '.btnmain'
    } ,
{
        referer : "$('.PBRelPdtTable table.PBLayoutTable').has('input[type=checkbox]:checked')",
        element : 'img',
        only : false,
        defaultZone : 'input[type=checkbox]'
    } ,
{
        referer : "$('.oxcell').has('a[href*=\"AddToCart(#productID#\"]')",
        element : 'img.imgthumbnail',
        only : true,
        defaultZone : '.btnaddtocart'
    } ,
{
        referer : "$('.PBOptImgTable td').has('a.btnoptaddtocart[href*=\"AddToCart(#productID#\"]')",
        element : '.PBOptImg img',
        only : true,
        defaultZone : '.PBOptBtn'
    } 
    ,
    {
        referer : "$('.sectiondataarea').has('.PBOptLstTable a.btnoptaddtocart[href*=\"AddToCart(#productID#\"]')",
        element : '.imgmain',
        only : true,
        defaultZone : '.btnoptaddtocart'
    } 
    ];
        
    // possibilité de rajouter des conditions
    if ( dc.extend ) original = original.concat( dc.extend );
    var itemToPush
    for (var key in original ) {
            
        itemToPush = original[key].referer.replace(/#productID#/gi ,nProductID);
        spotImage (eval (itemToPush), original[key].element, original[key].only, original[key].defaultZone)
    }
    // no image
    if (!isThereImages) {
        dc.clickNumber--;
        if (dc.clickNumber ==0 )  {
            dc.buildDetail (function () {
                if (dc.openMode) dc.openDetail ('andClose');
            });
            
        }
    }
}

//prototype déplacement vers le panier
dc.moveToCart = function  (origin, url) {
    this.domOrigin=origin;
    this.url=(!url)? null : url;
}
dc.moveToCart.prototype.moveInCart= function () {

    var isImage;
    var me=this;

    // récupération image
    if (this.url) {
        isImage = this.url;
        this.height = dc.defaultImgHSize;
        this.width = dc.defaultImgWSize;
    } else {
        // récupération src
        isImage = this.domOrigin.attr('src');
        this.height = this.domOrigin.outerHeight();
        this.width = this.domOrigin.outerWidth();
    }

    // si pas de src, on recherche une eventuelle bg-image
    if (!isImage) {
        var pattern = /url\(|\)|"|'/g,
        getUrl = this.domOrigin.css('backgroundImage');
        if (getUrl) {
            isImage= getUrl.replace(pattern,"");
            this.height = this.domOrigin.outerHeight();
            this.width = this.domOrigin.outerWidth();
        }
    }

    if (this.height<1) this.height = 1;
    var coef= this.width/this.height;
        
    if (!this.domOrigin.length || !isImage || isImage=="none")  return false;

    var offsetOrigin=this.domOrigin.offset();
    var offsetTarget=dc.miniCartId.offset();
    var outerSize = Math.ceil(dc.miniCartId.outerHeight()/dc.imgReduction);
    var topZone = Math.ceil( (dc.miniCartId.outerHeight() - outerSize)/2 )+offsetTarget.top;
    var speed =  parseInt (offsetOrigin.top - offsetTarget.top + 1000)  ;
    $('<img/>', {
        'src':isImage
    }).prependTo(document.body).css ({
        'z-index':3000,
        'position':'absolute',
        'top':offsetOrigin.top,
        'left':offsetOrigin.left,
        'height':this.height,
        'width': Math.ceil(this.height*coef)
    }).animate ({
        'height':outerSize,
        'width': Math.ceil(outerSize*coef),
        'top': topZone,
        'left':offsetTarget.left+(Math.round(dc.miniCartId.outerWidth()/2))
    }, speed, function () {
        if (me.onDone) me.onDone();  
    }).animate ({
        'opacity':0
    }, 500, function(){          
        $(this).remove();
    });
    return true;
}

//bouton continuer
dc.returnToSite = function () {
    dc.returnCartMain.parentNode.removeChild(dc.returnCartMain);
}

//Lancement de la fonction
$(function () {
    dc.scriptDownloader ();
});