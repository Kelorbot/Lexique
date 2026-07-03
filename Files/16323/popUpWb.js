/****************popup WB*************************/
function addLinksToWb( target, WbId, returnId, classPop ) {
    var testButtonArea= $(target);
    if (!returnId) returnId=false;
    if (!classPop) classPop =  false;
    else classPop = '"' +  classPop + '"';
    if (!testButtonArea.length) return;

    testButtonArea.attr ('href','javascript:openPopupWb('+WbId+', ' + returnId + ', ' + classPop + ');');
}
 
function openPopupWb(WbId, returnId, classPop){

    $('body').addWebBlock ({
        ID:WbId,
        insertionMode : 'prepend',
        hide:'manual',
        preFunction :  function (htmlContent) {

            /* Classe permettant de Styler différent Gabarit  */
            var classPopHtml = "" ;
            if( classPop != false ) classPopHtml = 'class="' + classPop + '"' ;
			
			if(typeof(returnText) == 'undefined') returnText = 'Retour sur la boutique';

            var closeLine = '<div class="wbCloseLine"><a href="/" id="goToSite"><span>' + returnText + '</span></a></div>' ;

            /* Si aucune pOp Up n'est ouverte...*/
            if(!$('#mainWbContent').length){

                htmlContent = '<div id="mainWbContent"><div id="bodyWbContent"></div><div id="wbContent" ' + classPopHtml + ' >' + closeLine  + htmlContent + '</div></div>';

                /* Dans le cas d'un CallBack, on remplace le bouton envoyer par la fonction en JS */
                if( returnId != false) {
                    /* on garde la classe classPop si besoin */
                    htmlContent = replaceFromTemplate (htmlContent, 'http:\\/\\/#CALLBACK#', 'javascript:sendCallbackForm('+WbId+', ' + returnId + ' );');
                }
                return htmlContent;
            }

            /* Si une pOp Up est ouverte, on surcharge le contenu*/
            else{
                $('#mainWbContent #wbContent').html('');
                $('#mainWbContent #wbContent').html( closeLine + htmlContent );
            }      
        },

        postFunction :  function () {

            $('#mainWbContent').css('height',$(document).height());
            $('#wbContent').css('top',$(window).scrollTop());
            $('a#goToSite').attr('href', 'javascript:closePopupWb()');

        }
    })
}

//soumission du WB formulaire en ajax
function sendCallbackForm (wbId, returnId, classPop) {

    // ajout d'une balise form
    var thisForm = $("#WBFormPopup");

    if (!thisForm.length) {
        $("#wbContent").wrapAll('<form id="WBFormPopup"/>');
        thisForm = $("#WBFormPopup");
    } 

    // vérification des champs obligatoires
    var thisFormTester = thisForm.serializeArray(),
    key;

    for (key in thisFormTester) {
        if (thisFormTester[key].value == "") {
            var currentlInput = $('*[name="'+thisFormTester[key].name+'"]');
            if (currentlInput.attr("wbvalreq")==1) {
                alert (currentlInput.attr("wbvalmsg"));
                return;
            }
        }
    }

    //envoi du formulaire
    postCallbackForm ();

    function postCallbackForm () {
        var postComplement, title = $('title');

        /* Rajout de d'infos sur la page courrante du visiteur */
        //nom du service
        if (typeof(OxPdtName) != 'undefined' && OxPdtName) {
            postComplement = '&WBF100-PAGE=SERVICE : ' + escape(unescape(OxPdtName.replace('&#92;', '')));
            launchPost (postComplement);
            return;
        }

        //ou nom du webblock
        if (typeof(OxCompName) != 'undefined' && OxCompName=='WebBlock' && typeof(OxPageName ) != 'undefined' && OxPageName ) {
            postComplement = '&WBF100-PAGE=WEBLOCK : ' + escape(unescape(OxPageName.replace('&#92;', '')));
            launchPost (postComplement);
            return;
        }

        // ou html title
        if (title.length ) {
            postComplement = '&WBF100-PAGE=PAGE : ' + escape(unescape(title.eq(0).html()));
            launchPost (postComplement);
            return;
        }

        //ou rien, mais on aura cherché quand mÃªme...
        launchPost (postComplement);
    }

    function launchPost (postComplement) {

        //envoi du formulaire
        $.post("PBCPPlayer.asp?PFORM=1&PW=1&ID=" + wbId, thisForm.serialize() + '&ActionID=0'  + postComplement, function(data) {
            showReturnCallback (data, wbId, returnId, classPop );
        });
    }

    // affichage du retour ou d'un WB
    function showReturnCallback (data, wbId, returnId, classPop) {

        if (!returnId) {
            var htmlModel = cleanHtmlTags (data);
            htmlModel = replaceFromTemplate (htmlModel, 'http:\\/\\/#RETURN#', 'javascript:returnToSite(\'#WBInfoZone\');');
            $('#wbContent').html(htmlModel);
        } else {

            openPopupWb (returnId, null, true, classPop);
        }
    }
}

//désactivation touche "entrée" des formulaires
function NoEnterKey() {
    var keycode = 0 ;
    if (window.event) keycode = window.event.keyCode;
    //NS? else if (event) keycode = event.which;
    if (keycode == 13) return false ;
    return true ;
}

/******************gestionnaire de template*************************/
function replaceFromTemplate (htmlModel, tag, value) {
    var reg = {
        tagValue:new RegExp(tag, "g")
    }
    htmlModel=htmlModel.replace(reg.tagValue,value);
    return htmlModel;
}

/***** Fermeture du pOp Up *******/
function closePopupWb(){
    $('#mainWbContent').remove();
}

/***** Appel de l'API Google pour les PDFs *******/
jQuery.fn.oxaviewer = function(settings) {
    settings = jQuery.extend({
        urlDoc : 'http://reussir-sa-boutique.oxatis.com/Files/28252/rsbl-Sommaire.pdf',
        iWidth : '100%',
        iHeight : 500,
        iClass : 'oxaViewer'
    }, settings);
    $(this).replaceWith('<iframe src="http://docs.google.com/viewer?url=' + settings.urlDoc + '&embedded=true" width="' + settings.iWidth + '" height="' + settings.iHeight + '" class="' + settings.iClass + '" frameborder="0"></iframe></p>');
}