/************************Ajax scheduler*****************/
//classe queryParameters
function queryParameters(){}
queryParameters.prototype.url = 'ws/wsGetCategories.asp?Mode=3&shopcart=1';
queryParameters.prototype.dataType = 'json';
queryParameters.prototype.cache = false;
queryParameters.prototype.answer = null;
queryParameters.prototype.fonction = null;
queryParameters.prototype.fonctionError = null;
queryParameters.prototype.addParams = null;
queryParameters.prototype.handleResponse = function(data) {
    if (this.fonction) this.fonction(data, this.addParams);
}
queryParameters.prototype.handleError = function() {
    if (this.fonctionError) this.fonctionError(this.addParams);
}

//classe queryDeclaration
function queryDeclaration (webService) {
    this.webService=webService;
}
queryDeclaration.prototype.onFinish = function (fn){
    this.onFinishCallBack=fn;
}
queryDeclaration.prototype.ajaxSend = function () {
    var local=this;
    $.ajaxSetup({
        'beforeSend' : function(xhr) {
            xhr.overrideMimeType('text/html; charset=iso-8859-1');
        }
    });
    $.ajax({
        url: this.webService.url,
        cache: this.webService.cache,
        dataType: this.webService.dataType,
        success: function(Data) {     
            local.webService.answer = Data;
            local.webService.handleResponse (Data);
            if (local.onFinishCallBack) local.onFinishCallBack();
        },
        error:function (xhr, ajaxOptions, thrownError){
            if (window.console) console.log ("error", xhr.status, thrownError);
            local.webService.handleError ();
        }
    });
}

/*classe chainProcessQueries*/
function chainProcessQueries (toSend){
    this.toSend = toSend;
    this.count=0;
}
chainProcessQueries.prototype.toDo = null; //fonction à exécuter une fois la chaine terminée
chainProcessQueries.prototype.exec = function () {
    var local = this;
    for (var i=0; i<this.toSend.length; i++) {
        this.toSend[i].onFinish(function(){
            local.returnProcess();
        });
        this.toSend[i].ajaxSend();
    }
}

chainProcessQueries.prototype.returnProcess = function(){
    this.count++;
    if ( this.toDo && (this.count == this.toSend.length) ) this.toDo();
}