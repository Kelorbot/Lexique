function WBGetValueOf( objInput )
{
	var varResult = "";
	switch ( objInput.type)
	{
		case "text" : 
		case "textarea" : 
			varResult = objInput.value.toString().replace(/ /gi, "");
		break;

		case "select-one" :
			if ( objInput.selectedIndex >= 0 )
				varResult = objInput.options[objInput.selectedIndex].value;
		break;

		case "select-multiple" :
			var nOptions = objInput.options.length;
			for( var i = 0 ; i < nOptions; i++ )
				if(objInput.options[i].selected)
				{
					varResult = true;
					break;
				}
		break;

		case "radio" :
			var nRadios = objInput.form[objInput.name].length;
			for( var i = 0 ; i < nRadios; i++ )
				if(objInput.form[objInput.name][i].checked)
				{
					varResult = (objInput.form[objInput.name][i].value ? objInput.form[objInput.name][i].value : true);
					break;
				}
		break;

		case "checkbox" :
			if( objInput.checked )
			varResult = objInput.value ? objInput.value : true;
		break;
	}
	return varResult;
}

function WBIsValidSelectedIndex( objInput )
{
	var varResult = true;
	if ( objInput.getAttribute("wbvalidxzero") == 1 )
		if( (objInput.type == "select-one") || (objInput.type == "select-multiple"))
			varResult = (objInput.selectedIndex > 0);
	return varResult;
}

function WBIsValidDate( objInput, bRequired )
{
	var bResult = true;
	if ( objInput.name.toString().length > 7 )
	{
		var strDateName = objInput.name.toString();
		if ( strDateName.substring(0, 7) == "WBF-DTD" )
		{
			var bDate = false, bTime = false;
			strDateName = strDateName.substring(7);
			if ( bDate = (objInput.form["WBF-DTM"+ strDateName] && objInput.form["WBF-DTY" + strDateName]) )
				bTime = (objInput.form["WBF-DTH" + strDateName ] && objInput.form["WBF-DTN" + strDateName]);

			if ( bDate )
			{
				var bValidDate = false;
				var nDay = objInput.form["WBF-DTD" + strDateName].selectedIndex;
				var nMonth = objInput.form["WBF-DTM" + strDateName].selectedIndex-1;
				var nYear = objInput.form["WBF-DTY" + strDateName].value;
				var objRegular = new RegExp("^\\d{4}$");
				nYear = nYear.replace( / /gi, "" );
				if ( bRequired || nDay || (nMonth != -1) || nYear.length )
				{
					if ((nDay == 0) || (nMonth == -1) || (!objRegular.test(nYear)))
						bResult = false;

					if ( bResult )
					{
						var dtDate = new Date( nYear, nMonth, nDay ); 
						if ( dtDate.getMonth() != nMonth )
							bResult = false; 
					}
					bValidDate = bResult;
				}
				if ( bResult && bTime )
				{
					var nHR = objInput.form["WBF-DTH" + strDateName].value.replace( / /gi, "" );
					var nMN = objInput.form["WBF-DTN" + strDateName].value.replace( / /gi, "" );
					if ( bRequired || nHR.length || nMN.length )
					{
						if ( !bValidDate || (nHR == "") || ( nMN == ""))
							bResult = false;
						else
						{
							var objRegular = new RegExp("^\\d{1,2}$");
							if ( (!objRegular.test(nHR)) || (!objRegular.test(nMN)) )
								bResult = false;
							else
								if ( (nHR > 23) || (nMN > 59) )
									bResult = false;
						}						
					}
				}
			}
		}
	}
	return bResult;
}

function WBShowErrorMsg( objInput, strDefaultMsg )
{
	var strmsg = objInput.getAttribute("wbvalmsg");
	if ( !strmsg ) strmsg = strDefaultMsg; 
	if ( strmsg )
	{
		//NOTE: Opera does not support string with HTML encoded char.
		alert(strmsg.toString());
		objInput.focus();
    }
	return false;
}

function WBGetIPCTNumFractSep( nLangID )
{
	return ( nLangID == 1 ) ? "." : ",";
}

function getRegExpOf( nwbType )
{
	var strRegular = null;
	switch( nwbType )
	{ 
		case 2 :
			strRegular =  "^[-]\\d{1,}$|^\\d{1,}$"; // +/- Integer
		break;
		case 4 :
			strRegular = "^\\d{1,}$|^[-]\\d{1,}$|^\\d{1,}\\#DS#\\d{0,2}$|^[-]\\d{1,}\\#DS#\\d{0,2}$"; // +/- Float.2
		break;
	}
	return strRegular;
}

function WBValidateNumber( objInput, strReg, fMin, fMax, nLangID )
{
	var bResult = true;
	var TempVar = objInput.value.replace( / /gi, "" );
	if ( TempVar.length > 0 )
	{
		var strSep = WBGetIPCTNumFractSep(nLangID);
		var Regular = new RegExp(strReg.replace(/#DS#/g, strSep));
		if ( !Regular.test(TempVar) ) bResult = false;
	    if ( bResult )
		{
			if ( strSep != "." )
			{
				var Reg = new RegExp(strSep,"gi");
				TempVar = TempVar.replace(Reg, ".");
			}
			TempVar = parseFloat(TempVar);
		}
		if ( bResult && (fMin && fMin.length > 0 ) )
			bResult = TempVar >= fMin;
		if ( bResult && (fMax && fMax.length > 0 ) )
			bResult = TempVar <= fMax;
	}
	return bResult;
}

function WBValidateEMail( objInput )
{
	var bResult = true, TempVar = objInput.value;
	if ( TempVar.length > 0 )
	{
		while(''+TempVar.charAt(TempVar.length-1)==' ') TempVar = TempVar.substring(0,TempVar.length-1);
		while(''+TempVar.charAt(0)==' ') TempVar = TempVar.substr(1,TempVar.length-1);
		objInput.value = TempVar;
	}

	if ( TempVar.length > 0 )
	{
		while( ( TempVar.length > 0 ) && ( bResult ) )
		{			
			var sEMail;
			var nIdx = TempVar.indexOf(";");
			if ( nIdx > -1 ) 
			{
				sEMail = TempVar.substr(0,nIdx);
				TempVar = TempVar.substr(nIdx+1);
			}
			else
			{
				sEMail = TempVar;
				TempVar = "" ;
			}

			// http://javascript.internet.com
			var emailPat=/^(.+)@(.+)$/;
			var specialChars="\\(\\)<>@,;:\\\\\\\"\\.\\[\\]";
			var validChars="\[^\\s" + specialChars + "\]";
			var quotedUser="(\"[^\"]*\")";
			var ipDomainPat=/^\[(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\]$/;
			var atom=validChars + '+';
			var word="(" + atom + "|" + quotedUser + ")";
			var userPat=new RegExp("^" + word + "(\\." + word + ")*$");
			var domainPat=new RegExp("^" + atom + "(\\." + atom +")*$");
			var matchArray=sEMail.match(emailPat);
			if (matchArray==null) 
			{
				bResult = false;
			}
			else
			{
				var user=matchArray[1];
				var domain=matchArray[2];
				if (user.match(userPat)==null)
				{
					bResult = false;
				}
				else
				{
					var IPArray=domain.match(ipDomainPat);
					if (IPArray!=null)
					{
						for (var i=1;i<=4;i++)
							if (IPArray[i]>255) 
								bResult = false;
					}
					else
					{
						var domainArray=domain.match(domainPat);
						if (domainArray==null)
						{
							bResult = false;
						}
						else
						{
							var atomPat=new RegExp(atom,"g");
							var domArr=domain.match(atomPat);
							var len=domArr.length;
							if (domArr[domArr.length-1].length<2 || domArr[domArr.length-1].length>4)
							   bResult = false;
							if (len<2)
							   bResult = false;
						}
					}
				}
			}
		}
	}
    return bResult;
}

function WBValidateCtrl( objInput, nLangID, strDefaultMsg )
{
	var bResult = true, strwbType, nwbType, nwbMaxLen, bRequired;
    bRequired = (objInput.getAttribute("wbvalreq") == 1);

	// Check for requiered
	if ( bRequired && ( (WBGetValueOf(objInput).toString().length == 0) ) )
		bResult = WBShowErrorMsg(objInput, strDefaultMsg);

	// wbvalidxzero == 1, required or not this is an inavlid value
	if ( bResult )
		if ( !WBIsValidSelectedIndex(objInput) )
			bResult = WBShowErrorMsg(objInput, strDefaultMsg);

	// Date must always be checked, required or not
	if ( bResult )
		if ( !WBIsValidDate(objInput, bRequired) )
			bResult = WBShowErrorMsg(objInput, strDefaultMsg);

	// Check for type
	if ( bResult )
    {
		// Opera return empty on null attribute.
		// Netscape is unable to convert null object to string.
		strwbType = objInput.getAttribute("wbvaltype");
		if ( strwbType && strwbType.length > 0 )
		{
			nwbType = parseInt(strwbType);
			switch ( nwbType )
			{
				case 1 :
					if ( !WBValidateEMail(objInput) )
						bResult = WBShowErrorMsg(objInput, strDefaultMsg);
				break;
                case 2 :
                case 4 :
					if ( !WBValidateNumber(objInput, getRegExpOf(nwbType), objInput.getAttribute("wbvalmin"), objInput.getAttribute("wbvalmax"), nLangID) )
						bResult = WBShowErrorMsg(objInput, strDefaultMsg);
				break;
                default :
					alert("Invalid Type " + nwbType +", validation canceled for '" + objInput.name + "'");
			}
		}
	}
	return bResult ;
}

function WBValidateForm( strForm, nLangID, strDefaultMsg )
{
	var bResult = true
	for ( var i = 0 ; i < document[strForm].length && bResult ; i++ )
	{
		switch( document[strForm][i].type )
		{
			case "text" : 
			case "textarea" : 
			case "select-one" :
			case "select-multiple" :
			case "radio" :
			case "checkbox" :
				bResult = WBValidateCtrl(document[strForm][i], nLangID, strDefaultMsg);
			break;
		}
	}
	return bResult;
}