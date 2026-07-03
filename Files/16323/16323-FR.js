function ficheProd(){
    if ( !$('.itemdetail').length) return;  

    /* Fiche Produit - */
    $('.PBItemPrice').before($('.PBItemTitle'));
    $('.PBItemPrice').parent().wrapInner('<div class="infoContainer"></div>');
    $('span.PBLongTxt:first').wrapInner('<div class="descContainer"></div>');
    $('.ficheSocial').appendTo('.descContainer');
    $('.PBOptionInfo:first').prependTo('.descContainer');
    $('#PBPdtOptions').prependTo('.descContainer');
    
    $('.imgcontainer').wrap('<div class="imgMainCont"></div>');
    
    if(!$('.imgthumblist').length) $('img.imgmain').wrap('<div class="containerImg"></div>')
    
    //$('.descContainer').before($('.infoContainer'));

    /*Onglet Fiche Produit*/
    $('.itemdetail ol li').productAddTabs({
        tabTitle : null,
        tabTag : '#([^#]+)#',
        defaultName : ['Description', 'Les +', 'Notre avis'],
        slideSpeed : 500
    });

    itemOptimizer ();

    $('#reinssuranceUp').appendTo($('.view:first'));
    
    $("#reinssuranceUp a").opacAnimate();    
    addLinksToWb ('a.infoPaiement', 1163853 ); 
    addLinksToWb ('a.infoLivraison', 1163852 ); 
    addLinksToWb ('a.infoContact', 1163854 ); 
    
    if(typeof(MagicZoomPlus) != 'undefined'){
        MagicZoomPlus.options = {
            'zoom-position':'right',
            'zoom-width' : 280,
            'hint':false,
            'hint-text':'',
            'show-loading':true,
            'loading-msg':'',
            'right-click':false,
            'disable-expand':false,
            'zoom-window-effect':false,
            'selectors-effect': false
        }    
    }   
    
    if($('.PBOptImgTable').length){	
        $('.PBOptImgTable').appendTo('.descContainer');
        $('.PBOptImgTable img').attr('width', '90');
    }
    
    if($('.PBRelPdtTable').length){
        $('.PBRelPdtTable img').attr('width', '50');
    }


    
}

$(function () {

    ficheProd();

    $('.footerWb').wrap('<div id="footerWebBlock"></div');
    $('#footerWebBlock').insertAfter('#footermenu');

    if($('.blockFeeds').length){
        $('.blockFeeds').rssfeed('http://www.facebook.com/feeds/page.php?format=atom10&id=152203226130', {
            limit: 3,
            linktarget: '_blank'
        });
    
        $('.cellProd').hover(function(){
            $(this).find('.descProd').stop(true).animate({
                top:0
            })
        },function(){
            $(this).find('.descProd').stop(true).animate({
                top:230
            })
        });
    }    

    
    

});