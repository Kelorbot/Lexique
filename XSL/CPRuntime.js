function NoEnterKey() 
{
	var keycode = 0 ;
	if (window.event) keycode = window.event.keyCode;
	//NS? else if (event) keycode = event.which;
	if (keycode == 13) return false ;
	return true ;
}
function NavListExec( objSelect )
{
	var nIndex = objSelect.selectedIndex;
	var strValue = objSelect.options[nIndex].value;
// Hack for Mozilla value return text when not defined!!	
	var strName = objSelect.options[nIndex].text;
	if ( strValue.length && (strName!=strValue))
		HLExecute(strValue)
}