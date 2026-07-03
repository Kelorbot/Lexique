function setEventListenerSavoirPlusSofinco(selecteur){
	
	document.querySelectorAll('.toggleSofincoPopin').forEach(function (el) {
		el.addEventListener("click", function(){
			if(document.querySelector(selecteur).style.display == 'block'){
				document.querySelector('#bodyarea').style.zIndex = 200;
				document.querySelector(selecteur).style.display = 'none'
			}else{
				document.querySelector('#bodyarea').style.zIndex = 1000;
				document.querySelector(selecteur).style.display = 'block'
			}
			return false;
		});
	});
}