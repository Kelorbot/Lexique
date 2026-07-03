	function WNDAPICreateSizeAttr( sAttr, nWidth, nHeight, nXOffset, nYOffset )
	{
		var nLeft, nTop ;
		if ( navigator.appName == "Netscape" )
		{
			nLeft = window.screenX + ((window.outerWidth - nWidth) / 2);
			nTop = window.screenY + ((window.outerHeight - nHeight) / 2);
		}
		else
		{
			nLeft = (screen.width - nWidth) / 2;
			nTop = (screen.height - nHeight) / 2;
		}
		if ( nXOffset != null ) nLeft += nXOffset ;
		if ( nYOffset != null ) nTop += nYOffset ;
		if ( sAttr.length > 0 ) sAttr += ","
		return( sAttr + "left=" + nLeft + ",top=" + nTop + ",width=" + nWidth + ",height=" + nHeight );
	}

	function WNDAPIOpenWindow( sWndName, sURL, sWndStyle, nWidth, nHeight, nXOffset, nYOffset )
	{
		if ( sWndName == null )	sWndName = "WNDAPI" ;
		if ( (nWidth != null) && (nHeight != null) )
			sWndStyle =  WNDAPICreateSizeAttr( sWndStyle, nWidth, nHeight, nXOffset, nYOffset );
		var objWin = window.open( sURL, sWndName, sWndStyle );
		if (objWin.focus) objWin.focus();
	}
