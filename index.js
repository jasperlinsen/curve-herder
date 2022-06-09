/* UTILITIES */
async function temporaryClassName( element, className, duration ){

    const _was = element.classList.contains( className );
    const _var = element.style.getPropertyValue( '--temporary-duration' );

    element.classList.add( className );
    element.style.setProperty( '--temporary-duration', `${duration}ms` );

    await delay( duration );

    element.classList.toggle( className, _was );

    if( _var ) element.style.setProperty( '--temporary-duration', _var );
    else element.style.removeProperty( '--temporary-duration' );

    // Allow the renderer to catch up on the removed animation class

    await frame_delay(2);

}
async function delay( delay ){

    return new Promise(r => setTimeout(r, delay));

}
async function frame_delay( frames = 1 ){

    let start = Date.now();;

    while( frames-- > 0 ) await new Promise( window.requestAnimationFrame );

    return Date.now() - start;

}
async function await_event( element, eventName ){

    return new Promise(r => element.addEventListener( eventName, r, { once: true } ));

}
function clamp( value, min = 0, max = 1 ){

    return Math.min( max, Math.max( min, value ) );

}

/* BASE CLASSES */

class Point {

    #x = 0;
    #y = 0;
    #tmp = [ 0, 0 ];

    constructor( x, y ){

        this.x = x;
        this.y = y;

    }

    get [0](){ return this.x; }
    get [1](){ return this.y; }

    set [0](x){ this.x = x; }
    set [1](y){ this.y = y; }

    get x(){ return this.#x; }
    get y(){ return this.#y; }

    set x(x){ this.#x = clamp( x ); }
    set y(y){ this.#y = clamp( y ); }

    [Symbol.iterator] = function *(){

        for( let i = 0; i < 2; i++ ) yield this[i];

    }

    toJSON(){

        return [ this.x, this.y ];

    }
    join( separator = ',' ){

        return `${this.x}${separator}${this.y}`;

    }

    distanceTo( point ){

        this.#tmp[0] = point.x - this.x;
        this.#tmp[1] = point.y - this.y;

        return Math.sqrt( this.#tmp[0]*this.#tmp[0] + this.#tmp[1]*this.#tmp[1] );
        
    }
    lerpTo( point, normal ){

        const [ sx, sy ] = this;
        const [ ex, ey ] = point;
        const dx = ex - sx;
        const dy = ey - sy;
        const mx = sx + dx * normal;
        const my = sy + dy * normal; 

        return new Point( mx, my );

    }

}
class Menu extends HTMLElement {

    static async awaitOptions( options, menuElement ){

        const tag = document.body.appendChild( menuElement || document.createElement( Menu.TAG_NAME ) );

        tag.innerHTML = ``;
        tag.setAttribute( 'type', 'options' );

        const promises = [];
        
        tag.append( ...options.map(option => {

            const li = document.createElement( 'li' );

            li.textContent = option.text;

            promises.push(new Promise(r => {

                li.addEventListener( 'click', event => {

                    if( option.handler ) option.handler();
                    r( option );
                    
                });

            }))

            return li;

        }) );

        const result = await Promise.race( promises );

        await tag.remove();

        return result;

    }
    static async awaitScore( time, list, duration = 2000, menuElement ){

        const tag = document.body.appendChild( menuElement || document.createElement( Menu.TAG_NAME ) );

        time = Math.floor(time/1000)

        tag.innerHTML = `
            <dl>
                <dt></dt>
                <dd>${score}</dd>
            </dl>
            <canvas></canvas>
        `;
        tag.setAttribute( 'type', 'score' );

        const scoreDOM = tag.querySelector( 'dd' );
        const timeDOM = tag.querySelector( 'dt' );

        let speed = duration / time;

        await delay(100);

        while( time >= 0 ){

            score = clamp( score + SCORING.PER_SECOND, 0, Infinity );

            scoreDOM.textContent = score;
            timeDOM.textContent = SCORING.PER_SECOND;

            await temporaryClassName( timeDOM, 'countdown', speed );
            //await new Promise(r => setTimeout( r, speed ));

            time--;
            speed /= 1.2;

            if( score <= 0 ) break;

        }

        const previewCanvas = tag.querySelector( 'canvas' );
        const previewCtx = previewCanvas.getContext( '2d' );
       
        await delay(100);
        
        previewCanvas.width = canvas.clientWidth;
        previewCanvas.height = canvas.clientHeight;

        speed = duration / list.length;

        for( const line of list ){

            score = clamp( score + SCORING.PER_SEGMENT, 0, Infinity );

            scoreDOM.textContent = score;
            timeDOM.textContent = `+${SCORING.PER_SEGMENT}`;

            line.progress = 1;

            drawLine( line, previewCtx, 1 );

            await temporaryClassName( timeDOM, 'countup', speed );

            speed /= 1.2;
            
        }

        timeDOM.textContent = time;
        timeDOM.classList.add( 'done' );

        delay( 2000 ).then(() => {

            timeDOM.textContent = 'Click';
            timeDOM.className = '';

        })

        await await_event( document, 'click' );
        await tag.remove();

        return score;

    }
    static async awaitDialog( text, menuElement ){

        const tag = document.body.appendChild( menuElement || document.createElement( Menu.TAG_NAME ) );

        tag.setAttribute( 'type', 'dialog' );
        tag.innerHTML = `
            <p>${text.replace( '\n', '</p><p>' )}</p>
            <button>OKE</button>
        `;

        await await_event( tag.querySelector( 'button' ), 'click' );
        await tag.remove();
        
    }
    static async awaitList( list, step = 5, menuElement ){

        const tag = document.body.appendChild( menuElement || document.createElement( Menu.TAG_NAME ) );
     
        let start = 0;
    
        while( true ){
            
            const less = start !== 0 ? { text: `Less` } : null;
            const end =  { text: '⭠' };
            const more = start < list.length - step ? { text: `More` } : null;
            const options = [
                less,
                ...list.slice( start, start + step ).map(text => ({ text })),
                more,
                end
            ].filter( Boolean );
            const selection = await Menu.awaitOptions( options, tag );
    
            switch( selection ){
                case less: start = clamp( start - step, 0, list.length - step ); break;
                case more: start = clamp( start + step, 0, list.length - step ); break;
                case end: return null;
                default: return selection.text;
            }
    
        }

        await tag.remove();

    }

    async remove(){

        await temporaryClassName( this, 'removed', 200 );

        super.remove();

    }

    static TAG_NAME = 'ch-menu';

}

customElements.define( Menu.TAG_NAME, Menu );

function randomPoint(){

    return new Point(
        Math.random(),
        Math.random()
    );

}
function addRandomLine(){

    const lastLine = lines[lines.length - 1];
    const from = lastLine && lastLine.to || randomPoint();
    const to = randomPoint();
    const cp1 = newInversedControlPoint( from )
    const cp2 = newRandomControlPoint(
        from,
        to,
        .5 + .5 * (1 - newControlFromCentered),
        newControlPointRadius
    );
    const newLine = {
        from,
        cp1,
        cp2,
        to,
        strokeStyle: colorOfAnglesBetween( cp1, cp2 ),
        lineWidth: Math.random() * 10 + 10,
        lineWidthMultiplier: 1,
        progress: 0,
        compositeOperation: compositeOperationurrentLine
    };

    lines.push( newLine );
    addNewLineToPointSet( newLine );

    return newLine;

}
function newRandomControlPoint( start, end, normal = .5, radius = .25 ){

    const [ mx, my ] = start.lerpTo( end, normal );
    const d = start.distanceTo( end ) * radius;
    const a = Math.random() * Math.PI * 2;

    return new Point(
        mx + Math.cos( a ) * d,
        my + Math.sin( a ) * d
    );

}
function randomColor(){

    const r = () => Math.floor(Math.random() * 255);

    return `rgb(${r()},${r()},${r()}`;

}

function newInversedControlPoint( point ){

    if( pointSet.has( point ) ){

        const cp = Array.from( pointSet.get( point ).cp ).shift();
        const ox = point[0] - cp[0];
        const oy = point[1] - cp[1];

        return new Point( point[0] + ox, point[1] + oy );

    }

    return randomPoint();

}
function addNewLineToPointSet( newLine ){

    pointSet.set( newLine.from, pointSet.get( newLine.from ) || { type: 'point', cp: new Set })
    pointSet.set( newLine.to, { type: 'point', cp: new Set })
    
    pointSet.set( newLine.cp1, { type: 'cp', origin: newLine.from });
    pointSet.set( newLine.cp2, { type: 'cp', origin: newLine.to });

    pointSet.get( newLine.from ).cp.add( newLine.cp1 );
    pointSet.get( newLine.to ).cp.add( newLine.cp2 );

    return newLine;

}
function colorOfAnglesBetween( cp1, cp2, saturation = 100, brightness = 50 ){

    const dx = cp2.x - cp1.x;
    const dy = cp2.y - cp1.y;

    return `hsl(${Math.floor(Math.atan2( dy, dx ) / Math.PI * 180)}, ${saturation}%, ${brightness}%)`;

}

function drawControlPoint( point, connectTo, context = overlayCtx ){

    if( connectTo ){

        context.save();

        context.strokeStyle = 'black';
        context.lineWidth = 1;

        context.beginPath();
        context.moveTo( point[0] * overlay.width, point[1] * overlay.height );
        context.lineTo( connectTo[0] * overlay.width, connectTo[1] * overlay.height );
        context.stroke();

        context.beginPath();
        context.arc( connectTo[0] * overlay.width, connectTo[1]  * overlay.height, 10, 0, Math.Pi * 2 );
        context.fillStyle = 'white';
        context.fill();
        context.stroke();

        context.restore();

    }

    if( point ){

        overlayCtx.fillStyle = 'black';
        overlayCtx.fillRect( point[0] * overlay.width - 5, point[1] * overlay.height - 5, 10, 10 );

    }

}
function drawLineCurved( line, context = ctx, progress ){

    const { from, to, cp1, cp2 } = line;
    
    const p = progress || line.p;
    const progressTo = from.lerpTo( to, p ); 
    const progressCP1 = from.lerpTo( cp1, p );
    const progressCP2 = progressTo.lerpTo( cp2, p );

    context.beginPath();
    context.moveTo( from[0] * canvas.width, from[1] * canvas.height );
    context.bezierCurveTo(
        progressCP1[0] * canvas.width,
        progressCP1[1] * canvas.height,
        progressCP2[0] * canvas.width,
        progressCP2[1] * canvas.height,
        progressTo[0] * canvas.width, 
        progressTo[1] * canvas.height
    );
    context.stroke();

    overlayCtx.clearRect( 0, 0, overlay.width, overlay.height );


}
function drawLineStraight( line, context = ctx, progress ){

    const { from, to } = line;
    const p = progress || line.p;
    const progressTo = from.lerpTo( to, p );

    context.beginPath();
    context.moveTo( from[0] * canvas.width, from[1] * canvas.height );
    context.lineTo( progressTo[0] * canvas.width, progressTo[1] * canvas.height );
    context.stroke();

}
function drawLine( line, context = ctx, progress ){

   // if( currentLine ){

        const { strokeStyle, lineWidth, lineCap = 'round', lineWidthMultiplier = 1, compositeOperation = 'source-over' } = line
        
        context.strokeStyle = strokeStyle;
        context.lineWidth = lineWidth * lineWidthMultiplier;
        context.lineCap = lineCap;
        context.globalCompositeOperation = compositeOperation;
        
        switch( type ){
            case 'curved': drawLineCurved( line, context, progress ); break;
            default: drawLineStraight( line, context, progress );
        }

    //}

}

/* UI */
function UIInputInit( id, callback, attr = 'value' ){

    const dom = document.getElementById( id );
    const callbackStorage = () => {

        localStorage.setItem( `${LOCALSTORAGE_NAMESPACE}:${id}`, JSON.stringify( dom[attr] ) )
        
        callback( dom[attr], dom );
    
    }

    defaults.set( dom, dom[attr] );

    dom[attr] = JSON.parse( localStorage.getItem( `${LOCALSTORAGE_NAMESPACE}:${id}` ) || JSON.stringify( dom[attr] ) );
    dom.addEventListener( 'input', callbackStorage );
    dom.addEventListener( 'change', callbackStorage );

    callback( dom[attr] );

    return dom;

}
function UIInputResetDefault(){
   
    defaults.forEach((value, dom) => {

        dom.value = value;
        dom.dispatchEvent( new CustomEvent( 'change' ) );

    });

}
function UIFrame( delta ){

    if( reconnectAllPoints ){

        pointSet.clear();

        lines.forEach( addNewLineToPointSet );

        reconnectAllPoints = false;

    }

    if( drawUI ) pointSet.forEach((data, point) => {

        if( data.fillStyle ){

            switch( data.type ){
                case 'point': {
                    
                    overlayCtx.fillStyle = data.fillStyle;
                    overlayCtx.strokeStyle = data.strokeStyle;
                    overlayCtx.lineWidth = 1;

                } break;
                case 'cp': {

                    if( !DISPLAY_ANCHORS ) return;

                    overlayCtx.save();
                    overlayCtx.beginPath();
                    overlayCtx.moveTo( point[0] * overlay.width, point[1] * overlay.height );
                    overlayCtx.lineTo( data.origin[0] * overlay.width, data.origin[1] * overlay.height  );
                    overlayCtx.globalCompositeOperation = 'destination-over';
                    overlayCtx.strokeStyle = 'black';
                    overlayCtx.lineWidth = 1;
                    overlayCtx.stroke();
                    overlayCtx.strokeStyle = 'white';
                    overlayCtx.lineWidth = 3;
                    overlayCtx.stroke();
                    overlayCtx.restore();

                    overlayCtx.fillStyle = 'black';
                    overlayCtx.strokeStyle = 'white';
                    overlayCtx.lineWidth = 1;

                };
            }
            
            overlayCtx.fillStyle = data.fillStyle;
            overlayCtx.globalAlpha = data.globalAlpha;

            overlayCtx.beginPath();
            overlayCtx.arc( point[0] * overlay.width, point[1] * overlay.height, UI_RADIUS, 0, Math.PI * 2 );
            overlayCtx.fill();
            overlayCtx.stroke();
            overlayCtx.restore();

        }

    });  

    return overlay;

}
function UIFrameIntersectionCanvas( delta ){

    recomputingIntersections = recomputingIntersections || getIntersections().then(data => {

        remainingIntersections = data.intersections;
        recomputingIntersections = null;

    });
    
    displayHintForTimeRemaining = clamp( displayHintForTimeRemaining - delta, 0 , 1000 );

    intersectionCtx.clearRect( 0,0, intersectionCanvas.width, intersectionCanvas.width );
    
    if( displayHintForTimeRemaining > 0 ){

        const allMarks = new Path2D;

        remainingIntersections.forEach(point => {

            const path = new Path2D;

            path.arc(
                point.x * intersectionCanvas.width,
                point.y * intersectionCanvas.height,
                50, 
                0,
                Math.PI * 2
            );

            allMarks.addPath( path );

        });

        // intersectionCtx.drawImage( buffer, 0,0, intersectionCanvas.width, intersectionCanvas.width );
        // intersectionCtx.globalCompositeOperation = 'destination-in';
        intersectionCtx.strokeStyle = 'white';
        intersectionCtx.beginPath();
        intersectionCtx.stroke( allMarks );
        // intersectionCtx.globalCompositeOperation = 'source-in';
        // intersectionCtx.fillRect( 0, 0, intersectionCanvas.width, intersectionCanvas.height );

    }

    return intersectionCanvas;

}

function lineListToSVGPath( lineList ){

    let fullPath = '';
    
    lineList.forEach(line => {

        const { from, cp1, cp2, to } = line;
    
        fullPath += `M ${from.join(' ')} C ${cp1.join(' ')}, ${cp2.join(' ')}, ${to.join(' ')}`

    });

    const asSVG = document.getElementById( 'path-calculator' ) || document.body.appendChild( new DOMParser().parseFromString( ` <svg id="path-calculator" viewBox="0 0 1 1" xmlns="http://www.w3.org/2000/svg" style="visibility:hidden;width:0;height:0">
        <path vector-effect="no-scaling-stroke" />
    </svg>`, 'image/svg+xml' ).querySelector( 'svg' ) );
    const pathSVG = asSVG.querySelector( 'path' );

    pathSVG.setAttribute( 'd', fullPath );

    return pathSVG.cloneNode( true );

}

async function getIntersections( amount = CHECK_PRECISION, rate = 50 ){

    const pathSVG = lineListToSVGPath( lines );
    const points = [];
    const length = pathSVG.getTotalLength();

    let f = 0;

    for( let i = 0; i <= length; i += length / amount ){

        const point = pathSVG.getPointAtLength( i );
        
        points.push( new Point( point.x, point.y ) );
        
        if( ++f > rate ){

            f = 0;
            await frame_delay();
            
        }

    }
    
    const intersections = [];
    
    for( const index in points ){
        
        const point = points[index];
        const previousPointIntersect = points.slice( 0, index - 1 ).find(p => {

            return p.distanceTo( point ) < length / amount;

        });

        if( previousPointIntersect && previousPointIntersect !== point ){

            intersections.push( previousPointIntersect );

        }
        
        if( ++f > rate ){

            f = 0;
            await frame_delay();
            
        }

    };

    return { intersections, path: pathSVG, d: pathSVG.getAttribute( 'd' ) };;

}
function generateNewLine(){

    const newLine = addRandomLine();

    if( currentLine ){

        newLine.duration = currentLine.from.distanceTo( newLine.to ) * Math.max( canvas.width, canvas.height ) * 2;

    }

    newLine.compositeOperation = compositeOperationurrentLine;
    newLine.lineWidthMultiplier = lineWidthScale;
    
    bufferCtx.clearRect( 0, 0, buffer.width, buffer.height );
    bufferCtx.drawImage( canvas, 0, 0, buffer.width, buffer.height );

    return newLine;

}
async function generatePuzzle( size = 5 ){

    [ canvas, buffer, overlay ].forEach(canvas => {

        canvas.width = innerWidth;
        canvas.height = innerHeight;

    });

    while( lines.length ) lines.shift();

    pointSet.clear();

    for( let i = 0; i < size; i++ ){

        const line = generateNewLine();

        //line.strokeStyle = 'red';

    }

    const hasIntersections =  await getIntersections();

    if( !hasIntersections.intersections.length ){

        return generatePuzzle( size );

    }

    currentLine = lines[lines.length - 1];
    redrawAllLines = 10;
    remainingIntersections = hasIntersections.intersections;

}

async function flashing_screen_colors(
    colors = [ 'red', 'green', 'blue', 'yellow' ],
    repeat = 4,
    delay = 10
){

    await frame_delay(10);

    const bg = document.body.style.getPropertyValue( '--bg' );
    const click = await_event( document.body, 'click' );

    repeatLoop: while( repeat-- > 0 ){

        const currentColors = colors.slice();

        colorLoop: while( currentColors.length ){

            const color = currentColors.shift();

            document.body.style.setProperty( '--bg', color );

            if( await Promise.race([ click, frame_delay( delay ) ]) ){
                
                break repeatLoop;

            }

        }

    }
    
    document.body.style.setProperty( '--bg', bg );

}
function secondsToTimeString( seconds ){

    const minutes = Math.floor( seconds / 60 );
    const s = seconds % 60;

    return `${minutes.toFixed().padStart( 2, '0' )}:${s.toFixed().padStart( 2, '0' )}`

}
async function uploadSVGForPathPilfering(){

    Menu.awaitDialog( 'You can now upload an SVG file...' );

}

/** DRAWING */
async function puzzleDrawIntro( duration = 1000 ){

    const { svg, path, d } = await getIntersections();
    const path2d = new Path2D( d );
    const length = path.getTotalLength();

    ctx.save();
    ctx.scale( canvas.width, canvas.height )
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 10 / Math.min(canvas.width,canvas.height);

    for( let i = 0; i <= duration; ){

        const p = i / duration;

        ctx.globalAlpha = p;
        ctx.setLineDash([ p * p * length, length * 10 ]);
        ctx.clearRect( 0, 0, canvas.width, canvas.height );
        ctx.stroke( path2d );
        
        i += await frame_delay(1);

    }

    ctx.restore();

}
async function puzzleDrawMainGame(){

    let delta = await frame_delay();

    while( true ){

        ctx.clearRect( 0, 0, canvas.width, canvas.height );
        ctx.drawImage( buffer, 0, 0, canvas.width, canvas.height );
    
        bufferCtx.clearRect( 0, 0, buffer.width, buffer.height );
        lines.forEach(line => drawLine( line, ctx, 1 ));
    
        [ UIFrame( delta ), UIFrameIntersectionCanvas( delta ) ].forEach(buffer => {
    
            ctx.drawImage( buffer, 0, 0, canvas.width, canvas.height );
    
        });
    
        if( !isPaused ){
            
            ticker += delta;
            
            if( remainingIntersections.length && lines.length ) puzzleTime += delta;
        
        }

        remainingOutput.textContent = remainingIntersections.length;
        timeOutput.textContent = secondsToTimeString( Math.floor( puzzleTime / 1000 ) );
    
        if( document.body.classList.toggle( 'you-won', !pointer.hold && !remainingIntersections.length ) ){

            break;

        }

        delta = await frame_delay();

    }

}
async function puzzleDrawEndGame(){

    await flashing_screen_colors([
        'gold', 'orange'
    ], 7, 10);

    canvas.width = canvas.width;
    canvas.height = canvas.height;

    const score = await Menu.awaitScore( puzzleTime, lines );
    const options = [
        { text: `Next puzzle` },
        { text: `Quit` }
    ];
    const option = await Menu.awaitOptions( options );

    switch( option ){
        case options[0]: {
            puzzleCompleted++;
            currentPuzzleLineCount++;
            await generatePuzzle( currentPuzzleLineCount );
            await playPuzzle();
        } break;
        case options[1]: {
            return mainMenu();
        } break;
    }

}

function parseLocalStorageLines(){

    const stored = JSON.parse( localStorage.getItem( `${LOCALSTORAGE_NAMESPACE}:beforeunload` ) || 'null' );

    if( stored ){

        stored.forEach(store => {

            store.cp1 = new Point( ...store.cp1 );
            store.cp2 = new Point( ...store.cp2 );
            store.from = new Point( ...store.from );
            store.to = new Point( ...store.to );

        });

    }

    return stored;

}

/** MAIN & MENUS */
async function playPuzzle(){

    puzzleTime = 0;

    const intersections = await getIntersections();

    remainingIntersections = intersections.intersections;

    await puzzleDrawIntro();
    await puzzleDrawMainGame();
    await puzzleDrawEndGame();

}
async function mainMenu(){

    currentPuzzleLineCount = localStorage.getItem( `${LOCALSTORAGE_NAMESPACE}:currentPuzzleLineCount` ) || currentPuzzleLineCount;
    resize();

    await generatePuzzle( currentPuzzleLineCount );

    let hasInLocalStorage = parseLocalStorageLines();

    repeatMenu: while( true ){
    
        const allOptions = [
            { text: 'Continue' },
            { text: `Play (${currentPuzzleLineCount})` },
            { text: 'Set Size' },
            { text: 'Test something' }
        ];
        const options = [ ...allOptions ];

        if( !hasInLocalStorage ) options.shift();

        const option = await Menu.awaitOptions( options );

        switch( option ){
            case allOptions[0]: if( hasInLocalStorage ){

                lines = hasInLocalStorage;
                lines.forEach( addNewLineToPointSet );

                playPuzzle();

                break repeatMenu;

            } break;
            case allOptions[1]: {

                localStorage.removeItem( `${LOCALSTORAGE_NAMESPACE}:beforeunload` );

                await generatePuzzle( currentPuzzleLineCount );
                await playPuzzle( currentPuzzleLineCount );

            } break repeatMenu;
            case allOptions[2]: {

                const nextCount = await Menu.awaitList( Array(15).fill(1).map((v,i) => i + 5) );
                
                if( nextCount !== null ){

                    currentPuzzleLineCount = nextCount;
                    await generatePuzzle( currentPuzzleLineCount );

                }

                localStorage.setItem( `${LOCALSTORAGE_NAMESPACE}:currentPuzzleLineCount`, currentPuzzleLineCount )

            } break;
            case allOptions[3]: {

                const tests = [
                    { text: `Game Complete Screen (5s/${currentPuzzleLineCount.length}lines)` },
                    { text: '⭠ Back to Main Menu' }
                ];
                const test = await Menu.awaitOptions( tests );

                switch( test ){
                    case tests[0]: {

                        await Menu.awaitScore( 5_000, lines );

                        await generatePuzzle( currentPuzzleLineCount );

                        score = SCORING.START;

                    } break;
                }

            } break;
        }

    }

}
async function init(){
    
    await Menu.awaitDialog( `Welcome to Curve Herder!
    This is a game about unwrapping a connected curve.
    Just click and drag the points until the curve is unfolded.` );
    await mainMenu();

}

/** CONTROLS */
function onPointerStart( event ){

    if( pointer.disabled ) return;

    const e = event.touches ? event.touches[0] : event;
    const x = e.clientX;
    const y = e.clientY;

    pointer.sx = x;
    pointer.sx = y;
    pointer.cx = x;
    pointer.cy = y;
    pointer.st = event.time;
    pointer.ct = event.time;
    pointer.down = true;

    if( pointer.over ) pointer.hold = pointer.over;

}
function onPointerMove( event ){

    if( pointer.disabled ) return;

    const e = event.touches ? event.touches[0] : event;
    const x = e.clientX;
    const y = e.clientY;
    const nx = x / innerWidth;
    const ny = y / innerHeight;

    pointSet.forEach((data, point) => {

        data.fillStyle = '';
        data.globalAlpha = 1;

    });

    if( !pointer.down && !pointer.hold ){

        const approachRadius = (APPROACH_RADIUS / Math.max( innerWidth, innerHeight ));
        const hoverRadius = (HOVER_RADIUS / Math.max( innerWidth, innerHeight ));

        let over = [];

        pointSet.forEach((data, point) => {

            if( !DISPLAY_ANCHORS && data.type === 'cp' ) return;

            const distance = new Point( nx, ny ).distanceTo( point );

            if( distance < hoverRadius ){

                over.push( point );

                data.globalAlpha = 1;
                data.fillStyle = data.type === 'cp' ? 'black' : 'white';
                
                data.cp && data.cp.forEach(cp => {

                    cp.fillStyle = 'black';
                    cp.globalAlpha = 1;
                    
                });

            } else if( !DISPLAY_CURSOR_FADEOUT ){

                data.globalAlpha = 1;
                data.fillStyle = data.type === 'cp' ? 'black' : 'white';

            } else if( distance < approachRadius ){

                data.globalAlpha = 1 - distance / (APPROACH_RADIUS / Math.max(innerWidth, innerHeight));
                data.fillStyle = data.type === 'cp' ? 'black' : 'white';

            }

        });
        
        pointer.over = over;

    } else if( pointer.hold ){

        const dx = (x - pointer.cx) / innerWidth;
        const dy = (y - pointer.cy) / innerHeight;

        pointer.hold.forEach(holding => {

            const pointData = pointSet.get( holding );

            holding[0] += dx;
            holding[1] += dy;
    
            if( pointData.cp && pointData.cp.size ) pointData.cp.forEach(cp => {
    
                cp[0] += dx;
                cp[1] += dy;

                const cpData = pointSet.get( cp );

                cpData.fillStyle = 'black';
                cpData.globalAlpha = 1;
    
            });

            pointData.fillStyle = 'orange';
            pointData.lineWidth = 10;
            pointData.globalAlpha = 1;

        });

        redrawAllLines = 1;

    }

    pointer.cx = x;
    pointer.cy = y;

}
function onPointerEnd( event ){

    pointer.down = false;
    pointer.hold = null;

}
function onBeforeUnload(){

    localStorage.setItem( `${LOCALSTORAGE_NAMESPACE}:beforeunload`, JSON.stringify( lines ) );

}

/** RENDERER */
function resize(){

    overlay.width =
    canvas.width = window.innerWidth;
    overlay.height =
    canvas.height = window.innerHeight;

    ctx.clearRect( 0, 0, canvas.width, canvas.height );
    ctx.drawImage( buffer, 0, 0, canvas.width, canvas.height );

    intersectionCanvas.width = 
    buffer.width = window.innerWidth;
    intersectionCanvas.height = 
    buffer.height = window.innerHeight;

    bufferCtx.drawImage( canvas, 0, 0, buffer.width, buffer.height );
    ctx.clearRect( 0, 0, canvas.width, canvas.height );

}

const canvas = document.getElementById( 'canvas' );
const ctx = canvas.getContext( '2d' );
const buffer = document.getElementById( 'buffer' );
const bufferCtx = buffer.getContext( '2d' );
const overlay = document.getElementById( 'overlay' );
const overlayCtx = overlay.getContext( '2d' );
const intersectionCanvas = document.getElementById( 'intersection' );
const intersectionCtx = intersectionCanvas.getContext( '2d' );
const intersectionBuffer = document.getElementById( 'intersection-buffer' );
const intersectionBufferCtx = intersectionBuffer.getContext( '2d' );

const INTERPOLATE_CUBIC = (v) => v * v;
const LOCALSTORAGE_NAMESPACE = 'draw-something';
const APPROACH_RADIUS = 200;
const HOVER_RADIUS = 20;
const UI_RADIUS = HOVER_RADIUS / 2;
const CHECK_PRECISION = 1000;
const DISPLAY_ANCHORS = false;
const DISPLAY_CURSOR_FADEOUT = false;
const SCORING = { START: 1000, PER_SECOND: -10, PER_SEGMENT: 50 };

const resetInput = document.getElementById( 'reset' );
const clearCanvasses = document.getElementById( 'clear' );
const moveNav = document.getElementById( 'move' );
const initialShownBuffer = document.querySelector( 'canvas:not([hidden]):not(:first-child)');

const remainingOutput = document.getElementById( 'remaining' );
const timeOutput = document.getElementById( 'time' );
const hintButton = document.getElementById( 'hint' );

let gameMode = 'puzzle';
let duration = 2000;
let ticker = 0;
let type = null;
let lines = [];
let defaults = new Map;
let newControlPointRadius = 2;
let newControlFromCentered = 1;
let durationMultiplier = 1;
let currentLine;
let compositeOperationurrentLine;
let lineWidthScale;
let isPaused = false;
let drawUI = false;
let interpolate = INTERPOLATE_CUBIC;
let deprecationMessageCounters = {};
let score = SCORING.START;
let currentPuzzleLineCount = 5;

let pointSet = new Map;
let redrawAllLines = 0;
let pointer = { disabled: false, cx: 0, cy: 0, sx: 0, sy: 0, hold: null, over: null,down: false, st: 0, ct: 0 };

let remainingIntersections = [];
let recomputingIntersections;
let reconnectAllPoints = true;
let puzzleTime = 0;
let puzzleCompleted = 0;

let displayHintForTimeRemaining = 0;

UIInputInit( 'draw-something-type', value => type = value );
UIInputInit( 'draw-something-cp-radius', value => newControlPointRadius = value );
UIInputInit( 'draw-something-cp-centered', value => newControlFromCentered = value );
UIInputInit( 'draw-something-duration-multiplier', value => durationMultiplier = value );
UIInputInit( 'draw-something-composite-operation', value => compositeOperationurrentLine = value );
UIInputInit( 'draw-something-line-width', value => lineWidthScale = value);
UIInputInit( 'draw-something-background-color', value => document.body.style.setProperty('--bg', value));
UIInputInit( 'draw-ui', value => drawUI = value, 'checked' );
UIInputInit( 'playpause', value => isPaused = value, 'checked' );
UIInputInit( 'show-buffer', value => initialShownBuffer && (initialShownBuffer.hidden = !value), 'checked' );

resetInput.addEventListener( 'click', event => {
    
    event.preventDefault();
    UIInputResetDefault();

});
clearCanvasses.addEventListener( 'click', event => {

    event.preventDefault();
    init();

});
moveNav.addEventListener( 'click', event => {

    event.preventDefault();
    document.querySelector( 'nav' ).classList.toggle( 'bottom-left' );

});
hintButton.addEventListener( 'click', event => {

    event.preventDefault();

    if( displayHintForTimeRemaining === 0 ){

        displayHintForTimeRemaining = 1000;

    }
    
});

window.addEventListener( 'mousedown', onPointerStart );
window.addEventListener( 'mousemove', onPointerMove );
window.addEventListener( 'mouseup', onPointerEnd );
window.addEventListener( 'beforeunload', onBeforeUnload );
window.addEventListener( 'resize', resize );

init();