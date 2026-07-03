function HLAddToFavorite( strURL, strName ) {
	if ((navigator.appName.indexOf("Microsoft",0)>=0) && (parseInt(navigator.appVersion)>=4))
		window.external.AddFavorite( strURL, strName );
	else
		alert("NOT SUPPORTED.");
	return ;
}

function HLCreateWinAttr( sAttr, nWidth, nHeight )
{
	var nLeft, nTop ;
	if ( navigator.appName == "Netscape" ) {
		nLeft = window.screenX + ((window.outerWidth - nWidth) / 2);
		nTop = window.screenY + ((window.outerHeight - nHeight) / 2);
	}
	else {
		nLeft = (screen.width - nWidth) / 2;
		nTop = (screen.height - nHeight) / 2;
	}
	return( sAttr + ",left=" + nLeft + ",top=" + nTop + ",width=" + nWidth + ",height=" + nHeight );
}

function HLGetParam( sParams, sParam, varDefault )
{
	var nIdx1, nIdx2, sResult = varDefault ;
	sParam = sParam + "[=]";
	nIdx1 = sParams.indexOf(sParam);
	if ( nIdx1 > -1 )
	{
		nIdx1 += sParam.length ;
		nIdx2 = sParams.indexOf("[&]",nIdx1);
		if ( nIdx2 > -1 )
			sResult = sParams.substr(nIdx1,nIdx2-nIdx1);
		else
			sResult = sParams.substr(nIdx1);
	}		
	return sResult ;
}

function HLExecute( sParams, bReturnHref )
{
	var nHLId, strAccID, nTmp, sTmp, nHLType = 1, sCUrl;
	var sWinStyle = "toolbar=yes,menubar=yes,scrollbars=yes,resizable=yes" ;
	var sTmp2, sTmp3;
	strAccID = HLGetParam(sParams,"accid", "");
	//if ( strAccID == null )
	//	strAccID = "" ;
	//else
	//	sParams = sParams.substr( 11 + strAccID.length ); // 11 = "accid[=][&]" ;
	nHLId = parseInt(HLGetParam(sParams,"hlid"));
	if ( nHLId & 32768 )
	{
		sTmp2 = parseInt(HLGetParam( sParams, "pwdx" ))
		sTmp3 = parseInt(HLGetParam( sParams, "pwdy" ))
		sWinStyle = HLCreateWinAttr( "scrollbars=yes,resizable=yes", sTmp2, sTmp3 );
		nHLType = 2 ;
	}
	switch( nHLId )
	{
		case 1:
		case 2048:
			sTmp = HLGetParam( sParams, "href" );
			if ( sTmp == null ) return ;
			if ( sTmp.charAt(0) != "/" ) {
				sTmp2 = sTmp.toLowerCase();
				if ( !((sTmp2.indexOf("http://")==0) || (sTmp2.indexOf("https://")==0) || (sTmp2.indexOf("ftp://")==0) || (sTmp2.indexOf("javascript:")==0) || (sTmp2.indexOf("mailto:")==0) || (sTmp2.indexOf("tel:")==0)) )
					sTmp = "http://" + sTmp ;
			}
			if ( nHLId == 2048 )
				nHLType = 1 ;
			else	 
				nHLType = 2 ;
			break;
		case 2:
			nTmp = parseInt(HLGetParam( sParams, "opmode" ));
			if ( nTmp == 4 )
			{
				nTmp = parseInt(HLGetParam( sParams, "comp" ));
				sTmp = "PBSearch.asp?CCode=" + nTmp ;
				nHLType = 1 ;
			}
			else if ( nTmp == 8 )
			{
				nTmp = parseInt(HLGetParam( sParams, "comp" ));
				if (nTmp==2){
					sTmp = "PBSCBrands.asp";
				} else if (nTmp==6){
					sTmp = "PBBrands.asp";
				}
				nHLType = 1 ;
			}
			else 
			{
				var nBrandID=0;
				nTmp = parseInt(HLGetParam( sParams, "comp" ));
				switch( nTmp )
				{
					case 1 : sTmp = "PBHomePage.asp" ; break ;
					case 2 : 
						sTmp = "PBSCCatalog.asp";
						nBrandID = parseInt(HLGetParam(sParams, "brandid", 0));
						break ;
					case 3 : sTmp = "PBHotNews.asp" ; break ;
					case 4 : sTmp = "PBHotLinks.asp" ; break ;
					case 5 : sTmp = "PBFAQ.asp" ; break ;
					case 6 : 
						sTmp = "PBCatalog.asp";
						nBrandID = parseInt(HLGetParam(sParams, "brandid", 0));
						break ;
					case 7 : sTmp = "PBSubscribe.asp" ; break ;
					case 8 : sTmp = "PBPartners.asp" ; break ;
					case 9 : sTmp = "PBBios.asp" ; break ;
					case 10 : sTmp = "PBContactUS.asp" ; break ;
					case 11 : sTmp = "PBGuestBook.asp" ; break ;
					case 12 : sTmp = "PBEvents.asp" ; break ;
					case 13 : sTmp = "PBJobListing.asp" ; break ;
					case 14 : sTmp = "PBPhotos.asp" ; break ;
					case 18 : sTmp = "PBChat.asp" ; break ;
					case 24 : sTmp = "PBClassified.asp" ; break ;
					case 25 : sTmp = "PBClassifiedAdd.asp" ; break ;
					case 26 : sTmp = "PBRealEstateKind.asp" ; break ;
					case 27 : sTmp = "PBRealEstateLocation.asp" ; break ;
					case 28 : sTmp = "PBRealEstateType.asp" ; break ;
					case 29 : sTmp = "PBRealEstateSearch.asp" ; break ;
					case 32 : sTmp = "PBShoppingCart.asp" ; break ;
					case 33 : sTmp = "PBUserAccount.asp" ; break ;
					case 34 : sTmp = "PBSalesRepSystem.asp" ; break ;
					case 36: sTmp = "PBSponsorship.asp"; break;
					case 58: sTmp = "PBStoreLocator.asp"; break;
					case 60: sTmp = "PBRSSFeeds.asp"; break;
					case 1200 : sTmp = "Blog.asp" ; break ;
					default : 
						alert("Unknown Component [" + nTmp + "]");
						nHLType = 0 ;
				}
				if ( nHLType == 1 )
				{
					nTmp = parseInt(HLGetParam( sParams, "itmid" ));
					if ( nTmp > 0 )
						sTmp = sTmp + "?ItmID=" + nTmp ;
					else
					{
						nTmp = parseInt(HLGetParam( sParams, "catid",0));
						if (( nTmp > 0 ) || (nBrandID > 0)){
							var strSep='?';
							if ( nTmp > 0 ){
								sTmp += strSep + "CatID=" + nTmp;
								strSep = '&';
							}
							if (nBrandID > 0){
								sTmp += strSep + "BrandID=" + nBrandID;
								strSep = '&';
							}
						} else {
							sTmp = sTmp + "?PBMInit=1" ;
						}
					}
				}
			}
			break ;
		case 4:
			if (typeof (OxImagePlayer) != "undefined") {
				nHLType = 0;
				sTmp = "/Files/" + strAccID + "/" + HLGetParam(sParams, "imgfn");
				OxImagePlayer(strAccID, sTmp);
				break;
			}
			sTmp = "ImagePlayer.asp?AccID=" + strAccID;
			nTmp = parseInt(HLGetParam(sParams, "imgid"));
			if (nTmp > 0) sTmp = sTmp + "&ImgID=" + nTmp;
			sTmp2 = HLGetParam(sParams, "imgfn");
			if (sTmp2 != null) sTmp = sTmp + "&ImgFN=" + sTmp2;
			sWinStyle = HLCreateWinAttr("scrollbars=no,resizable=yes", 300, 240);
			nHLType = 2;
			break;
		case 8:
			sTmp = HLGetParam( sParams, "emto", "" );
			sTmp2 = HLGetParam( sParams, "emsj", "" );
			sTmp = "EmailPopupWnd.asp?EMTO=" + sTmp + "&EMSJ=" + sTmp2 ;
			sTmp2 = HLGetParam( sParams, "ccod" );
			if ( sTmp2 != null )
			{
				sTmp3 = HLGetParam( sParams, "dbid" );
				if ( sTmp3 == null ) sTmp3 = "";
				sTmp = sTmp + "&CCOD=" + sTmp2 + "&DBID=" + sTmp3
			}				 
			sWinStyle = HLCreateWinAttr( "scrollbars=yes,resizable=yes", 500, 426 );
			nHLType = 2 ;
			break ;
		case 32:
			sTmp = HLGetParam( sParams, "addr", "" );
			sTmp2 = HLGetParam( sParams, "city", "" );
			sTmp3 = HLGetParam( sParams, "zip", "" );
			sTmp = "MapPopupWnd.asp?ADDR=" + sTmp + "&CITY=" + sTmp2 + "&ZIP=" + sTmp3 ; 
			sTmp3 = parseInt(HLGetParam( sParams, "ctry", 0 ));
			if ( sTmp3 > 0 ) sTmp = sTmp + "&COUNTRYID=" + sTmp3 ;
			sWinStyle = HLCreateWinAttr( "scrollbars=no,resizable=yes", 760, 540 );
			nHLType = 2 ;
			break ;
		case 128:
			nTmp = parseInt(HLGetParam( sParams, "cpid" ));
			sTmp = "PBCPPlayer.asp?ID=" + nTmp ;
			break ;
		case 32896:
			nTmp = parseInt(HLGetParam( sParams, "cpid" ));
			sTmp = "PBCPPlayer.asp?PW=1&ID=" + nTmp ;
			break ;
		case 256:
		case 33024:
			nTmp = parseInt(HLGetParam( sParams, "wpid" ));
			sTmp = "PBWPPlayer.asp?ID=" + nTmp ;
			break ;
		case 512:
			//sTmp = "ContactPopupWnd.asp?CTID=0&AccID=" + strAccID
			//sWinStyle = HLCreateWinAttr( "scrollbars=no,resizable=no", 500, 300 );
			//nHLType = 2 ;
			sTmp = "PBCompanyProfile.asp"
			break;
		case 4096: 
			history.go(-1);
			return ;
			break;
		case 16384 :
			window.close();				
			return ;
			break;
		case 8192:
			nTmp = parseInt(HLGetParam( sParams, "flid" ));
			sTmp = "PBFilePlayer.asp?ID=" + nTmp ;
			sWinStyle = HLCreateWinAttr( "scrollbars=yes,resizable=yes", 500, 300 );
			nHLType = 2 ;
			break;
		default:
			if ( sParams.indexOf("@") == -1 )
			{
				sTmp = sParams
				nHLType = 2 ;
			}
			else
			{
				sTmp = "EmailPopupWnd.asp?EMTO=" + sParams ; 
				sWinStyle = HLCreateWinAttr( "scrollbars=yes,resizable=yes", 500, 426 );
				nHLType = 2 ;
			}
	}

	sCUrl = HLGetParam(sParams, "curl")
	if (sCUrl && sCUrl.length) sTmp = sCUrl;

	switch( nHLType )
	{
		case 1:
			if (bReturnHref == true)
				return sTmp;
			window.location = sTmp;
			//alert("window.location = '" + sTmp + "'" )
			break;
		case 2:
			if (bReturnHref == true){
				if(sTmp.indexOf("mailto:")==0 || sTmp.indexOf("tel:")==0){
					return sTmp;
				}
				else{
					return "javascript:window.open('" + sTmp + "','HLWindow" + nHLId + "','" + sWinStyle + "');void(0);";
				}
			}
				
			var objWin = window.open(sTmp, "HLWindow" + nHLId, sWinStyle);
			if (objWin.focus) { objWin.focus(); }
			//alert("window.open('" + sTmp + "')" )
			break;
	}
}
