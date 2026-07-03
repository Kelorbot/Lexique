(function ($)
{


    $.fn.productAddTabs = function (options)
    {
        if ($('.wbe-editor-toolbar-wrapper').length)
            return this;

        var defaults = {
            target: 'itemTabs',
            anchor: 'ol',
            urlParam: 'tab',
            tabTitle: 'h1, h2, h3, h4, h5, h6',
            tabTag: null,
            defaultName: 'Onglet #n', // le #n sera remplacé par le numéro de l'onglet : "Onglet 1", "Onglet 2", etc.
            autoSlide: false,
            crossTransition: false,
            autoHeight: false,
            autoWidth: false,
            timeToSlide: 3000,
            slideSpeed: 500,
            stopAfterFirstClick: false,
            htmlTemplate: '<div class="list"></div><div class="zone"></div>',
            tabContainer: 'ul',
            tabLister: 'li',
            zIndex: 10,
            reviewsTab: false
        };

        var opts = $.extend(defaults, options);
        var domElements = $(this);
        
        productAddTabs(domElements, opts);

        function isArray(testObject)
        {
            return testObject && !(testObject.propertyIsEnumerable('length')) && typeof testObject === 'object' && typeof testObject.length === 'number';
        }

        function productAddTabs(domElements, options)
        {

            //On s'accroche à l'encre si spécifiée

            if (options.anchor && $(options.anchor).length)
            {
                $(options.anchor).replaceWith('<div id="' + options.target + '"/>');
            }

            if (!options.anchor && !$('#' + options.target).length)
            {
                domElements.wrapAll('<div id="' + options.target + '"/>');
            }

            var tags = [],
                    zone = [],
                    x = 0,
                    y = 0,
                    i = 1,
                    tempContent,
                    regTab,
                    testTab;


            $('#' + options.target).css({
                'position': 'relative'
            });

            // récupération des élemetns du texte enrichi
            domElements.each(function ()
            {

                var thisZone = $(this),
                        thisTag = (options.tabTitle) ? $(options.tabTitle, this).eq(0) : null,
                        titleTag = "",
                        noTag = true;

                if (options.autoWidth)
                    x = Math.max(thisZone.width(), x);
                if (options.autoHeight)
                    y = Math.max(thisZone.height(), y);

                // utilisation des onglets personnalsiés balises
                if (thisTag && thisTag.length)
                {
                    titleTag = thisTag.detach().html();
                    noTag = false;
                }

                // utilisation des onglets personnalsiés tabTag
                if (options.tabTag)
                {

                    function testTag()
                    {
                        tempContent = thisZone.html();
                        //  if (window.console) console.log ('tempContent', tempContent);
                        if (!tempContent)
                            return;
                        regTab = new RegExp(options.tabTag, 'gi');
                        testTab = regTab.exec(tempContent);
                        // if (window.console) console.log ('testTab', testTab);
                        if (!testTab || !testTab.length > 1)
                            return;
                        titleTag = testTab[1];
                        // if (window.console) console.log ('titleTag', titleTag);
                        noTag = false;
                        thisZone.html(tempContent.replace(testTab[0], ''));
                    }

                    testTag();
                }

                // utilisation des onglets par défaut  
                if (noTag)
                {
                    var Tag = options.defaultName;
                    if (isArray(Tag))
                    {
                        var arrayLength = Tag.length;
                        var j = (i > arrayLength) ? arrayLength : i;
                        titleTag = Tag[j - 1];
                    }
                    else
                    {
                        titleTag = options.defaultName;
                    }

                    if (titleTag.match(/#n/g))
                        titleTag = titleTag.replace(/#n/g, i);
                }

                tags.push('<' + options.tabLister + ' class="tagListElements" ><a class="tagLinks tagLink' + i + '"><span>' + titleTag + '</span></a></' + options.tabLister + '>');
                thisZone.wrapInner('<div class="tagsZone tagZone' + i + '" />');
                var tempZoneChild = thisZone.children().detach();
                zone.push(tempZoneChild);
                i++;
            });
            
            if (options.reviewsTab && tags.length && $('.viewReviews').length)
            {
                var reviewsIndex = i;
                var titleTag = $('#ProductReviews .PBReviewTitle').html();
                tags.push('<' + options.tabLister + ' class="tagListElements" ><a class="tagLinks tagLink' + i + '"><span>' + titleTag + '</span></a></' + options.tabLister + '>');
                $('#ProductReviews').wrapInner('<div class="tagsZone tagZone' + i + '" />');
                $('#ProductReviews .PBReviewTitle').remove();
                var tempZoneChild = $('#ProductReviews').children().detach();
                zone.push(tempZoneChild);
                $('.viewReviews').remove();
            }


            // Position initiale diaporama
            var numberOfItems = tags.length,
                    timeOut,
                    uriCourant = document.location.href,
                    reg = new RegExp("[&\\?]" + this.urlParam + "=(\\d+)", "g"),
                    infosInUrl = reg.exec(uriCourant);

            var current = null,
                    next = (infosInUrl && infosInUrl.length > 0 && parseInt(infosInUrl[1]) > 0 && parseInt(infosInUrl[1]) <= numberOfItems) ? parseInt(infosInUrl[1]) : 1;

            //création HTML
            $('#' + options.target).html(options.htmlTemplate);

            $('#' + options.target + ' .zone:first').replaceWith('<div class="tagsListZone" style="position:relative;"></div>');
            $('#' + options.target + ' .list:first').replaceWith('<' + options.tabContainer + ' class="tagsList">' + tags.join('') + '</' + options.tabContainer + '>');
            for (var j = 0; j < numberOfItems; j++)
            {
                $('#' + options.target + ' .tagsListZone:first').append(zone[j]);
            }

            var zones = $('#' + options.target + ' .tagsListZone:first .tagsZone');

            zones.css({
                'opacity': 0
            });

            zones.css({
                'left': 0,
                'top': 0,
                'position': 'absolute'
            })
                    .hide();

            if (options.autoHeight)
                $('#' + options.target + ' .tagsListZone:first .tagsZone').height(y);
            if (options.autoWidth)
                $('#' + options.target + ' .tagsListZone:first .tagsZone').width(x);


            shadeIt(1);
            // fonction de transition fondu/enchainé :
            function shadeIt(speed)
            {

                if (current == next)
                    return;
                if (current)
                {
                    var currentZone = $('#' + options.target + ' .tagsListZone:first > .tagZone' + current);

                    if (options.crossTransition)
                    {
                        currentZone.css({
                            'position': 'absolute'
                        });
                    }

                    currentZone.animate({
                        'opacity': 0,
                        'z-index': 0
                    }, {
                        duration: speed,
                        complete: function ()
                        {
                            $(this)
                                    .css({
                                        'position': 'absolute'
                                    })
                                    .hide();
                            if (!options.crossTransition)
                                showNext();
                        }
                    });


                    $('#' + options.target + ' .tagsList:first > .tagListElements > .tagLink' + current).removeClass('taghighlighted');
                }

                $('#' + options.target + ' .tagsList:first > .tagListElements > .tagLink' + next).addClass('taghighlighted');

                if (options.crossTransition || !current)
                    showNext();

                function showNext()
                {
                    var toMove = $('#' + options.target + ' .tagsListZone:first > .tagZone' + next);

                    toMove
                            .css({
                                'position': 'relative'
                            })
                            .show();

                    toMove.animate({
                        'opacity': 1,
                        'z-index': options.zIndex
                    }, {
                        duration: speed,
                        complete: function ()
                        {
                            if (this.style.removeAttribute)
                                this.style.removeAttribute('filter');
                        }
                    });
                }
                current = next;
            }

            // affichage zone correspondante lors du clic sur un élement du carousel
            $('#' + options.target + ' .tagsList:first .tagLinks').bind('click', function ()
            {
                var meAgain = $(this).attr('class'),
                        reg = new RegExp('tagLink(\\d+)', 'g');
                next = parseInt(reg.exec(meAgain)[1], 10);

                if (options.autoSlide)
                {
                    clearTimeout(timeOut);
                }
                if (options.autoSlide && !options.stopAfterFirstClick)
                {
                    autoscroll();
                }
                shadeIt(options.slideSpeed);
            });

            //auto défilement
            function autoscroll()
            {
                timeOut = setTimeout(function ()
                {
                    next = (next < numberOfItems) ? next + 1 : 1;
                    shadeIt(options.slideSpeed);
                    autoscroll();
                }, options.timeToSlide);
            }

            if (options.autoSlide)
            {
                autoscroll();
            }

            function showTab(index)
            {
                next = index;

                if (options.autoSlide)
                {
                    clearTimeout(timeOut);
                }
                if (options.autoSlide && !options.stopAfterFirstClick)
                {
                    autoscroll();
                }
                shadeIt(options.slideSpeed);
            }

            function moveToTabs()
            {
                $('body, html').animate({
                    scrollTop: $('#' + options.target + ' .tagsList:first').offset().top - 60
                }, 400);
            }

            // gestion des actions sur les avis
            if (options.reviewsTab && tags.length)
            {
                // check if we need to go to reviews tab
                // if params tab is present in url go to reviews tab
                if (/^#ProductReviews$/i.test(window.location.hash))
                {
                    showTab(reviewsIndex);
                    setTimeout(function(){
                        moveToTabs();
                    }, options.slideSpeed);
                }

                // clic sur la note globale du produit
                $('#OxReviewsAvg .PBLink').click(function ()
                {
                    showTab(reviewsIndex);
                    setTimeout(function(){
                        moveToTabs();
                    }, options.slideSpeed);
                });
            }
        }

        return this;
    };

})(jQuery);
