/*addWB V1.3*/

(function($){
    
    $.fn.addWebBlock = function(options) {
            
        var defaults = { 
            ID : null,
            html : null,
            insertionMode : 'after',
            ajaxCache : true,
            hide: 'never', // 'auto' : affichage unique du weBLock lors de la visite, 'manual' affichage du weBLock jusqu'Ã  ce que l'url contienne setcookie=1( disclaimer-type )
            setCookie : 'setcookie', //paramètre à rajouter dans  l'URL si on veut forcer l'état du cookie setcookie=0 -> afficher / setcookie=1 > ne pas afficher
            preFunction : null,// fonction à  exécuter après import - function (HTMLContent, target)  {  return modifiedHTMLContent; } 
            postFunction : null // fonction à  exécuter après affichage - function (target) { }
        };

        var opts = $.extend(defaults, options);
        var domElements	= $(this);

        addWebBlock(domElements,  opts);     
                
        function addWebBlock (domElements,  options) {
            
            options.hide = options.hide.toLowerCase();
            options.insertionMode = options.insertionMode.toLowerCase();
            options.setCookie = options.setCookie.toLowerCase();
            
            //détection paramètre URL
            var uriCourant = document.location.href;
            var reg= new RegExp ("[&\\?]"+options.setCookie+"=(\\d+)", "gi");
            var infosInUrl = reg.exec(uriCourant);
            var setcookie = 0;
            if(infosInUrl && infosInUrl.length>0 && infosInUrl[1]=="1") setcookie=1;
            if(infosInUrl && infosInUrl.length>0 && infosInUrl[1]=="0") setcookie=-1;
            
            
            //vérification du mode affichage 
            function checkOneTime () {
                // retourne "false" si le Wb ne doit pas être affiché
                var display = false;
                
                if ( options.hide == 'never' ) display = true;
                else {  
                    var cookie = getCookie(options.setCookie);   
                    var displaycookie = (cookie)? 1 : 0;
                    
                    if (options.hide == 'auto' || setcookie > 0 )  setCookie (options.setCookie, 'ok', 30);                    
                    if (setcookie < 0 )   setCookie (options.setCookie, '', -1);
                   
                    if ( (displaycookie + setcookie) < 1 ) display = true;
                   
                }    
                return display;   
            }

           
            if ( !checkOneTime() || !domElements.length) return;
            
            // import wb ajax
            var tempurl = null;
            
            if (options.ID && !options.html) { 
                $.ajax({
                    url: 'ws/wsGetWebBlock.asp?WBID='+options.ID,
                    cache: options.ajaxCache,
                    dataType:'json',
                    success: function(Data) {
                        importTemplate (Data, true);
                    }
                }); 
            }
            if (options.html && !options.ID) {
                 
                $.ajax({
                    url: options.html,
                    cache: options.ajaxCache,
                    contentType : " Content-type: text/plain; charset=iso-8859-1",
                    beforeSend: function(jqXHR) {
                        jqXHR.overrideMimeType("text/html;charset=iso-8859-1");
                    },
                    dataType:'html',
                    success: function(Data) {
                        importTemplate (Data);
                    }
                }); 
            }
             
            function importTemplate (data, wbMode) {
                if (wbMode && (!data || data.error) ) return;
                
                // exécution fonction apès import
            
                var localData = (wbMode)? data.htmlContent : data;
                if (options.preFunction) localData = options.preFunction(localData, domElements);

                switch(options.insertionMode) {

                    case ('replace'):
                        domElements.html(localData);
                        break;

                    case ('prepend'):
                        domElements.prepend(localData);
                        break;

                    case ('append'):
                        domElements.append(localData);
                        break;

                    case ('after'):
                        domElements.after(localData);
                        break;

                    case ('before'):
                        domElements.before(localData);
                        break;
                }
                // exÃ©cution fonction après affichage
                if (options.postFunction) options.postFunction(domElements);
            }

        }
        return this;	
    }
})(jQuery);