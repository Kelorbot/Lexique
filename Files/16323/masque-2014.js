facet = {}
facet.url = '/tous-nos-produits-c102x2390980';
facet.targetLink = '#targetFacetCatalog';

facet.getDomIframe = function(){    
    $('<iframe style="display: none;" id="frameFacet" src="' + facet.url + '" onload="facet.getLoadedIframe()"></iframe').appendTo($('body'));    
}

facet.getLoadedIframe = function(){
    var d = document.getElementById('frameFacet').contentDocument;        
    var m = $(d).find('#blockfacets');
    $(d.MForm).find('.view').remove();
    $(d.MForm).appendTo($('body'));  
    $(d).find('script[src^="javascript/facets"]').appendTo($('body'));
    $(m).clone().appendTo($('#facetBlock'));    
    $(m.next('script')).appendTo($('body'));
	$('#facetBlock').addClass('col' + $('#facetBlock .blockfacet').length);
	
	
	 
}

facet.init = function(){
    if(!$('.webblock ').length) return; 
    facet.getDomIframe();    
}

$(function(){    
    facet.url = $(facet.targetLink).attr('href') || facet.url;
    $(facet.targetLink).remove();    
    facet.init();
	/*$('.facetminmax').each(function(){
        var p = $(this).parents('.blockfacet:first');
        var max = parseInt(p.find('.facetrangemax').val()); 
        var min = parseInt(p.find('.facetrangemin').val());
        var id = p.attr('id').replace(/blockfacet/gi, '');
        $('<div class="facetslider"><div id="facetslider' + id + '" class="facetslider"></div><div id="facetsliderrange' + id + '" class="facetsliderrange"><span class="min">' + min + '</span><span class="sep">-</span><span class="max">' + max + '</span></div>').insertAfter($(this));
        
        facetSliderInit(id,min,max,min,max);
        p.find('.facetreset').appendTo(p.find('.blockarea'));

        $(this).hide();        
    }); */
})