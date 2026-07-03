$(function () {

	/*Permet de retourner la position du BackGround*/	
		jQuery.fn.opacAnimate = function(settings) {
				settings = jQuery.extend({
				opacHover : 0.7,
				opacOut : 1, 
				opacTime : 200
				}, settings);

				if(typeof($.browser) === 'undefined') return;
				
				if( !($.browser.msie  && parseInt($.browser.version, 10) === 7) ) {
				
					/* Si opacOut est différent de 1...*/	
					if(settings.opacOut!=1)$(this).animate({opacity:settings.opacOut},0);	
					
					/*Fonction permettant le Hover*/
					$(this).hover(function(){ $(this).animate({opacity:settings.opacHover},settings.opacTime);},
						function(){ $(this).stop(true).animate({opacity:settings.opacOut},settings.opacTime);
						});			
					} 
					
			 };	
		}
	
)