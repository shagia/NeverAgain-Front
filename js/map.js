const MARKER_S_MIN = 0.07;
const MARKER_S_MAX = 0.15;
const SCRIPT = {
  instagram: {
    src: "https://www.instagram.com/embed.js",
    class: "instagram-media"
  },
  twitter: {
    src: "https://platform.twitter.com/widgets.js",
    class: "twitter-tweet"
  }
};

var Map = function(cfg){
  this.width = cfg.width;
  this.height = cfg.height;
  this.container = cfg.container;
  this.svg = this.container.append("svg");
  this.aspect = this.width / this.height;
  this.projection = d3.geoAlbersUsa().translate([this.width / 2, this.height / 2]);
  this.path = d3.geoPath(this.projection);
  this.isDataLoaded = false;
  this.setup();
  this.loadData();

}


//setup svg container and responsive container
Map.prototype.setup = function(){

  this.svg.attr("width", this.width)
          .attr("height", this.height);


  this.svg.attr("viewBox", "0 0 " + this.width + " " + this.height)
           .attr("perserveAspectRatio", "xMinYMid meet");
  this.resize();

  this.tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  window.addEventListener("resize", this.resize.bind(this));
}

//responsive container resize
Map.prototype.resize = function() {
  var targetWidth = parseInt(this.container.node().parentNode.clientWidth);
  this.svg.attr("width", targetWidth);
  this.svg.attr("height", Math.round(targetWidth / this.aspect));

  if(window.innerWidth < 992){
   var newHeight = 'calc(100vh - ' + (document.getElementById('title').offsetHeight + document.getElementById('map').offsetHeight) + 'px';
 }else{
   var newHeight = 'calc(100vh - ' + document.getElementById('title').offsetHeight + 'px';
 }
  document.getElementById('social-content-parent').style.height = newHeight;
}

Map.prototype.loadData = function(){
  var self = this;

  d3.queue()
    .defer(d3.json, "assets/data/us-light.json") //load us map data
    .defer(d3.xml, "assets/map-marker.svg")//load marker from external svg from a file
    .defer(d3.json, "https://neveragain.youthradio.org/api/posts") //fetch data form api
    .await(function(error, us, xml, data){
      if (error) return console.log(error);
        self.isDataLoaded = true;
        self.drawMap(us)
        self.markerSVG = document.importNode(xml.documentElement, true);
        self.data = data;
        self.loadTimeline();
    });
}
Map.prototype.start = function(){
  var self = this;

  d3.queue()
    .defer(function(callback){
      checkLoadedData(); //wait all data to be load
      function checkLoadedData() {
        setTimeout(function(){
         if(self.isDataLoaded){
           callback(null);
         }else{
           checkLoadedData();
         }
       }, 5);
     }
    })
    .await(function(error){
      if (error) throw error;
      self.drawMarkers(); //then show markers
    });
}

Map.prototype.drawMap = function(us) {
  this.svg.append("g").selectAll(".states")
    .data(topojson.feature(us, us.objects.states).features)
    .enter().append("path")
    .attr("class", "states")
    .attr("d", this.path);

  this.svg.append("path")
    .datum(topojson.mesh(us, us.objects.states, function(a, b) {
      return a !== b;
    }))
    .attr("class", "state-borders")
    .attr("d", this.path);
}

Map.prototype.drawMarkers = function(){
  var self = this;
  var n = 0;
  this.markers = this.svg.selectAll("marker")
    .data(self.data.posts.filter(function(e){ return (e.geo ? ((e.geo.geo[0] || e.geo.geo[1]) != 0) : false); }))
    .enter()
    .append('svg')
    .attr("class", function(e){ return "marker marker-" + e.category })
    .append("g")
    .each(function() {
      this.appendChild(self.markerSVG.cloneNode(true).children[0]);
    })
    .attr("id", function(e){ return "id-" + e.slug})
    .attr("data-loc",function(e){ return e.geo.suburb + " " + e.geo.state })
    .on("mouseover", mouseOver)
    .on("mouseout", mouseOut)
    .on("click", mouseClick)

    .attr("transform", function(post) {
      return "translate(" + (self.projection(post.geo.geo)[0]) + "," + (-Math.random() * 1000) + ")scale(" + MARKER_S_MAX + "," + MARKER_S_MAX + ")";
    })
    .transition()
    .ease(d3.easeBounce)
    .duration(1500)

    .attr("transform", function(post) {
      return "translate(" + (self.projection(post.geo.geo)[0]) + "," + (self.projection(post.geo.geo)[1]) + ")scale(" + MARKER_S_MIN + "," + MARKER_S_MIN + ")";
    })
    .each(function() { ++n; })
    .on("end", function() {
      d3.select(this).node().parentNode.classList.add('hidden-marker');
      if (!--n) self.enableScrollEvents(); //enable scroll events afer markers fixed
    });



    function mouseOver(e, i) {
      self.toggleToolTip(true, [d3.event.pageX, d3.event.pageY], e.geo.suburb + " " + e.geo.state)
      var transform = d3.select(this).attr("transform");
      var scaleV = 0.06;
      d3.select(this).attr("transform", setTransform("translate", getTransform(transform, "translate")) + setTransform("scale", [MARKER_S_MAX, MARKER_S_MAX]));
      d3.select(this.parentNode).raise();
    }
    function mouseClick(e, i) {
      var ele = document.getElementById("post-id-" + e.slug);
      var timeline = document.getElementById("social-content-parent");
      var h = timeline.getBoundingClientRect().height;
      self.lazyLoadElement(ele);
      timeline.scrollTo(0, ele.offsetTop);
      replaceClass(ele, 'hidden','active');
    }
    function mouseOut(d, i) {
      self.toggleToolTip(false);
      var transform = d3.select(this).attr("transform");
      var scaleV = -0.06;
      d3.select(this).attr("transform", setTransform("translate", getTransform(transform, "translate")) + setTransform("scale", [MARKER_S_MIN, MARKER_S_MIN]));
      d3.select(this.parentNode).raise();
    }
}
Map.prototype.toggleToolTip = function(mode, pos, text){
  var self = this;
  if(mode){
      self.tooltip.transition()
                    .duration(500)
                    .style("opacity", .9);
      self.tooltip.html(text)
                  .style("left", pos[0] + "px")
                  .style("top", (pos[1] - 28) + "px");
  }else{
    self.tooltip.transition()
                  .duration(500)
                  .style("opacity", 0);
  }
}
Map.prototype.loadTimeline = function(){
  var self = this;

  self.chapters = d3.select('#social-content').selectAll('div').select('div')
                   .data(self.data.categories);

  self.chapters.attr("class", "update");

  self.chapters.enter()
          .append('div')
          .attr('id', function(e){ return e.key })
          .attr('data-social', 'chapter')
          .each(function(e, i){
                if(i > 0 && i < self.chapters.enter().size() - 1) d3.select(this).attr('class', 'hidden')
          })
          .append('div')
          .attr('class', 'chapter-header')
          .html(function(chapter){
              return( chapter.body.html );
          });

  self.chapters.exit().remove();

  self.chapters.enter()
              .each(function(chapter) {
                  d3.select('#' + chapter.key).selectAll('div').select('div')
                                  .data(self.data.posts.filter(function(e){ return (e.geo ? ((e.geo.geo[0] || e.geo.geo[1]) != 0) : false) })
                                                       .filter(function(e){ return e.category === chapter.key }))
                                  .enter()
                                  .append('div')
                                  .attr('class', 'hidden post my-4 pt-2')
                                  .attr('id', function(p){
                                    var id = p.slug;
                                    return "post-id-" + id;
                                  })
                                  .attr('data-social', function(post){ if(post.social.length > 0){ return post.social[0].type }})
                                  .html(function(post){
                                    var top = '<h4>' + post.geo.suburb + ' ' + post.geo.state + '</h4>';
                                    if(post.social[0].type == 'twitter'){
                                        var twtPofileURL = "https://neveragain.youthradio.org/api/twitter/" + post.social[0].url.split('status')[0].split('/')[3];
                                        var twtEmbed = post.social[0].embed.split(/(>)/);
                                        twtEmbed.splice(2,0,"<img class='rounded-circle' src='" + twtPofileURL + "'>");
                                        return top  + twtEmbed.join('');
                                    }
                                    return top + (post.social.length > 0 ? post.social[0].embed:"");
                                  });

              });
  //reaplace tags for lazy loading
  document.querySelectorAll(".twitter-tweet").forEach(function(ele, i){
    if(i > 2){
     ele.className = "lazy-load";
   }else{
     ele.className = "lazy-load";
     self.lazyLoadElement(ele.parentNode);
   }
  });
  document.querySelectorAll(".instagram-media").forEach(function(ele, i){
    ele.className = "lazy-load";
    self.lazyLoadElement(ele.parentNode);
  });

}

Map.prototype.enableScrollEvents = function(){
  var self = this;
  //scroll events
  var scrollEvent = d3.select(window).on("wheel.zoom", mouseWheelScrool);
  function mouseWheelScrool(e){
    d3.event.preventDefault();
    var ele = document.getElementById("social-content-parent");
    ele.scrollTop += d3.event.deltaY;
  }

  var currentPostId = -1;
  var lastPostId = -1;
  var currentChapterId = -1;
  var lastChapterId = -1;

  document.getElementById("social-content-parent").addEventListener("scroll", function (event) {
    var box = this;
    var h = box.getBoundingClientRect().height;

    this.querySelectorAll("[data-social=chapter]").forEach(function(chapter){
        if(self.isElementOnScreen(box, chapter, h/2) && currentChapterId !==  chapter.id){
          lastChapterId = currentChapterId;
          currentChapterId = chapter.id;
          replaceClass(chapter,'hidden','active');
          chapter.querySelectorAll('.post').forEach(function(marker){
            var markerOn = d3.select('#' + marker.id.split('post-')[1]); //select marker
            d3.select(markerOn.node().parentNode).raise(); //raise marker to front
            replaceClass(markerOn.node().parentNode,'hidden-marker','active');
          });
          if(lastChapterId !== -1){
            var lastChapter = document.getElementById(lastChapterId);
            replaceClass(lastChapter,'active','hidden');
            lastChapter.querySelectorAll('.post').forEach(function(marker){
              var markerOff = d3.select('#' + marker.id.split('post-')[1]); //select marker
              replaceClass(markerOff.node().parentNode,'active', 'hidden-marker');
            });
          }
        }
        chapter.querySelectorAll('.post').forEach(function(visibleEle){
          if(self.isElementOnScreen(box, visibleEle, h/2) && currentPostId !==  visibleEle.id){
            lastPostId = currentPostId;
            currentPostId = visibleEle.id;

            if(visibleEle.getAttribute('data-social') === 'twitter'){
                self.lazyLoadElement(visibleEle);
            }
            var markerOn = d3.select('#' + visibleEle.id.split('post-')[1]); //select marker
            d3.select(markerOn.node().parentNode).raise(); //raise marker to front
            var transform = markerOn.attr("transform"); //get transform attributes
            //start transiton
            markerOn
              .attr("transform", setTransform("translate", getTransform(transform, "translate")) + setTransform("scale", [MARKER_S_MIN, MARKER_S_MIN]))
              .transition()
              .ease(d3.easeExp)
              .duration(800)
              .attr("transform", setTransform("translate", getTransform(transform, "translate")) + setTransform("scale", [MARKER_S_MAX, MARKER_S_MAX]))
              .on("end", function(){
                var markerBox = markerOn.node().getBoundingClientRect();
                self.toggleToolTip(true,[markerBox.x, markerBox.y], markerOn.attr('data-loc'));
              });
              replaceClass(visibleEle, 'hidden','active');
              //if is an new post, transform last marker
              if(lastPostId !== -1){
                replaceClass(document.getElementById(lastPostId), 'active','hidden');
                var markerOff = d3.select('#' + lastPostId.split('post-')[1]);
                var transformOff = markerOff.attr("transform");
                self.toggleToolTip(false);
                markerOff
                  .attr("transform", setTransform("translate", getTransform(transformOff, "translate")) + setTransform("scale", [MARKER_S_MAX, MARKER_S_MAX]))
                  .transition()
                  .ease(d3.easeExp)
                  .duration(800)
                  .attr("transform", setTransform("translate", getTransform(transformOff, "translate")) + setTransform("scale", [MARKER_S_MIN, MARKER_S_MIN]));
              }
          }
        }); //loop chapter elemetns
    }); //loop chapters
  });
}
Map.prototype.isElementOnScreen = function(box, visibleEle, position){
  var visibleElerec = visibleEle.getBoundingClientRect();
  return ((box.scrollTop + position) >= visibleEle.offsetTop && (box.scrollTop + position) <= (visibleEle.offsetTop + visibleElerec.height));
}
Map.prototype.lazyLoadElement = function(ele) {
  //create virtual script and force dom to load it
  if(ele.querySelector('.lazy-load') !== null){
    if (ele.getAttribute('data-social')) {
      var lazyParams = SCRIPT[ele.getAttribute('data-social')];
      var script = document.createElement("script");
      //replace lazy-load tag
      ele.querySelector('.lazy-load').className = lazyParams.class;
      script.src = lazyParams.src;
      script.async = true;
      script.defer = true;
      ele.appendChild(script);
    }
  }
}

//start new instance of map
var map = new Map({
  width: 960,
  height: 600,
  container: d3.select("#map")
});

//splash page transition
d3.select('#splash-button').on('click',function(){
  d3.select("#splash-bg").style("position","absolute")
     .style("top","0px")
     .transition()
     .duration(1000)
     .ease(d3.easeBack)
     .style("top", function(){ return this.offsetHeight + "px" })
     .on("end", function(){
       this.style.display = 'none';
       map.start();
       document.getElementById('footer-container').hidden = false;
     });
});
//util
// parse values to array for transform modes, scale, transform,etc
function getTransform(str, mode){
   var value = str.match(new RegExp(mode + "\\(([^)]+)\\)"))[1].split(",");
   return value.map(function(e){return Number(e)});
}
function setTransform(mode, value){
     return mode + "(" +  value.join(',') + ")";
}
function replaceClass(ele, oldClass, newClass){
  var s = ele.getAttribute('class');
  ele.setAttribute('class', s.replace(oldClass, newClass));
}
