function itemOptimizer (options) {
    
    var defaults = { 
            page : '.itemdetail',
            targetSocialZone : '#socialZone',
            tabsReferer : '#itemTabs',
            targetReinsurance : '#reinsurance',
            targetReinsuranceTop : '#reinsuranceUp',
            targetReinsuranceBottom : '#reinsuranceDown',
            optionsTables : '.PBOptImgTable, .PBOptLstTable', 
            upsellTable : '.PBUpsellTable',
            relPdtTable  : '.PBRelPdtTable',
            closestCrossSell : '.sectiondata',
            optionsClear : true
        };
        var opts = $.extend(defaults, options);

    if (!$(opts.page).length) return;

    var firstTr = $('.PBItemTitle').closest('td');
    var anchorOptions = $(opts.optionsTables);

    if (!$(opts.tabsReferer).length) {
         $(opts.targetReinsurance).before(anchorOptions);
    } 
    else {
        $(opts.tabsReferer).before(anchorOptions);
        $(opts.tabsReferer).before($(opts.targetReinsuranceTop));
    }
    
    var bottomZone = null;
    var relPdtTable = $(opts.relPdtTable);
    var upsellTable = $(opts.upsellTable);
    if (relPdtTable.length) bottomZone=relPdtTable.closest(opts.closestCrossSell);
    if (upsellTable.length) bottomZone=upsellTable.closest(opts.closestCrossSell);
    
    if (bottomZone) bottomZone.after($(opts.targetReinsuranceBottom));
    $(opts.targetReinsuranceBottom).show();
    if (opts.optionsClear) $(anchorOptions).css({'clear' : 'both'});

    $(opts.targetSocialZone).appendTo(firstTr);
     
}

