/**********loginBox V1***********/

var loginHeader = {};
loginHeader.connect = "Connexion";
loginHeader.prefix = "";
loginHeader.suffix = "";
loginHeader.url = "/PBUserLogin.asp?CCode=33";
$(function () 
{
    loginHeader.target = $('#dynlogin').eq(0);
    if (!loginHeader.target.length) return;
    
    loginHeader.className = "loginButton";
    
    if (loginHeader.user) {
        loginHeader.connect = (loginHeader.user.firstname && loginHeader.user.lastname)?  loginHeader.user.firstname + ' ' + loginHeader.user.lastname : loginHeader.user.email;
        loginHeader.connect = loginHeader.prefix + loginHeader.connect + loginHeader.suffix;
        loginHeader.className = "AccountButton";       
    
        loginHeader.logout = $('<a/>', {
            href:'javascript:void(0);',
            'class' : 'logoutButton',
            html:'<span>X</span>'
        });
        loginHeader.space = $('<span/>', {
            'class' : 'logoutSpace'
        });
    }

    
    loginHeader.button = $('<a/>', {
        href: loginHeader.url,
        'class' : loginHeader.className
    });
    
    loginHeader.textButton = $('<span/>', {
        html : loginHeader.connect
    });
    
    
    loginHeader.target.append (loginHeader.button);
    
    loginHeader.button.append (loginHeader.textButton);
    
    if (loginHeader.logout) {
        loginHeader.target.append (loginHeader.space);
        loginHeader.target.append (loginHeader.logout);
        loginHeader.logout.click( function () {
            $.ajax({
                url:'PBUserAccount.asp',
                cache: false,
                type:'post',
                data:'ActionID=1',
                dataType:'html',
                success: function(data) {
                    window.location.replace(loginHeader.url);
                }
            }); 
        });
    }
});

