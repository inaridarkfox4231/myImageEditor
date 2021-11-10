p5.DisableFriendlyErrors = true;
"use strict";

// 2021/11/11
// んー。
// まあいいんだけど
// pixelDensity(1)使うとか
// 画像のリサイズ使うとか
// 改善点ないわけじゃないわね

// 画像ドロップのテストというか練習。
// takawoさんのhttps://www.openprocessing.org/sketch/903217を参考にしつつ。

// これだけだとあまりにもあまりにもなので
// 目標を作りましょう。
// 1:選択したポジションの色が透明になり、それをボタンクリックで保存できるようにする。
// 名前は指定した色が#234221だとして「_a234221」みたいのが付く、適当に。
// 2:モノクロにすることができるようにする。「_grey」が付く。
// 3:指定色でモノトーンが・・「_m1122ff」とか付く。

// 仕組みを理解するところから。

// clearしてからもう一度、っていうのが失敗の原因っぽい。
// やめた方が、いいかな・・・
// clearを廃止する。

// JPGでも大丈夫だけどサイズがでかすぎるとまずいらしい。
// ちょっとそこら辺工夫が要るかな・・たとえば縦も横も1000以下に抑えるとか。
// 全く同じ大きさで返す必要があるとは限らないし、実用考えたらそこまで大きいのも使わないでしょ・・分からないけど。

// つららうまくいった。
// そうね、1000以下に抑えましょうかね。

// なんか勝手にサイズが2倍になるっぽいですね・・どういう仕様なんだ。
// 4000x3000だと8000x6000になっちゃうってこと？そりゃバグるわな。。。ほんとjsって謎だらけだわ。
// まあp5.saveの仕様なんだろうけど。さてと、アルファやってみるかぁ。

// クリックして、アルファしてない場合のみパレットの色が変わる、その色になる。で、
// アルファしたあとはリセットしない限り同じ操作ができないようにする、と。

// 2倍されるの困るから2で割ります・・・

// pixelDensityを1にすれば2倍関連の面倒な処理要らないよ！

// 255, 127, 39のオレンジ、これで枠を用意して、そのときのstateが分かりやすいようにしよう。
// なんかフィルター置く？sobelとか。

let editModule;

const ORIGINAL = 0;
const GRAY = 1;
const ALPHA = 2;
const SOBEL = 3;
const LAPLA = 4;

const SIZE_LIMIT = 2000; // 2000くらいでも大丈夫そう。ただ、2で割るけど。

let vs =
"precision mediump float;" +
"attribute vec3 aPosition;" +
"void main(void){" +
"  gl_Position = vec4(aPosition, 1.0);" +
"}";

let fs =
"precision mediump float;" +
"uniform vec2 u_resolution;" +
"uniform int u_mode;" +
"uniform vec3 u_target;" + // 透過させる色。
"uniform sampler2D u_img;" +
"const int ORIGINAL = 0;" + // そのまま
"const int GRAY = 1;" + // 灰色にする
"const int ALPHA = 2;" + // 特定の色をアルファにする。バリデーションどうするんだ。。1e-6くらいでやるか。
"const int SOBEL = 3;" + // sobelとかいうフィルタ。
"const int LAPLA = 4;" + // laplacianフィルタ。
// ソベルフィルタ。浮き出るような質感。
"vec4 getSobel(in vec2 p, in vec3 baseColor){" +
"  vec2 grid = vec2(1.0 / u_resolution.x, 1.0 / u_resolution.y);" +
"  vec3 destColor = baseColor;" +
"  for(float x = -1.0; x < 1.1; x += 1.0){" +
"    destColor += texture2D(u_img, p + vec2(x, -1.0) * grid.x).rgb * 1.0 * (-x);" +
"    destColor += texture2D(u_img, p + vec2(x, 0.0) * grid.x).rgb * 2.0 * (-x);" +
"    destColor += texture2D(u_img, p + vec2(x, 1.0) * grid.x).rgb * 1.0 * (-x);" +
"  }" +
"  for(float y = -1.0; y < 1.1; y += 1.0){" +
"    destColor += texture2D(u_img, p + vec2(-1.0, y) * grid.y).rgb * 1.0 * (-y);" +
"    destColor += texture2D(u_img, p + vec2(0.0, y) * grid.y).rgb * 2.0 * (-y);" +
"    destColor += texture2D(u_img, p + vec2(1.0, y) * grid.y).rgb * 1.0 * (-y);" +
"  }" +
"  return vec4(destColor, 1.0);" +
"}" +
// ラプラシアンフィルタ。2階微分。
"vec4 getLaplacian(in vec2 p, in vec3 baseColor){" +
"  vec2 grid = vec2(1.0 / u_resolution.x, 1.0 / u_resolution.y);" +
"  vec3 destColor = baseColor * 25.0;" +
"  for(float x = -2.0; x < 2.1; x += 1.0){" +
"    for(float y = -2.0; y < 2.1; y += 1.0){" +
"      destColor -= texture2D(u_img, p + vec2(x * grid.x, y * grid.y)).rgb;" +
"    }" +
"  }" +
"  return vec4(destColor, 1.0);" +
"}" +
"void main(void){" +
"  vec2 p = gl_FragCoord.xy * 0.5 / u_resolution.xy;" +
"  p.y = 1.0 - p.y;" + // 逆なので。
"  vec4 color = texture2D(u_img, p);" +
"  if(u_mode == GRAY){" +
"    color.xyz = vec3((color.x + color.y + color.z) / 3.0);" +
"  }else if(u_mode == ALPHA){" +
"    if(length(u_target - color.xyz) < 1e-6){ color.a = 0.0; }" +
"  }else if(u_mode == SOBEL){" +
"    color = getSobel(p, color.rgb);" +
"  }else if(u_mode == LAPLA){" +
"    color = getLaplacian(p, color.rgb);" +
"  }" +
"  gl_FragColor = color;" +
"}";

/*
"  float grid = 1.0 / min(u_resolution.x, u_resolution.y);" +
"  vec3 destColor = texture2D(base, st.xy).rgb;" +
"  if(laplacian){" +
"    destColor = texture2D(base, st.xy).rgb * 25.0;" +

"  }" +
*/

function setup(){
	let base = createCanvas(640, 560);
	editModule = new MyEditor();
  base.drop(getImage);
}

function draw(){
  editModule.draw();
}

class MyEditor{
	constructor(){
		this.active = false;
		this.frame = createGraphics(640, 480);
		this.frame.fill(0);
		this.frame.textSize(20);
		this.frame.textAlign(CENTER, CENTER);
		this.configBoard = createGraphics(640, 160);
		this.configBoard.noStroke();
		this.originalName = "";
		this.originalImg = undefined;
		this.usingImg = undefined;
		this.usingShader = undefined;
		this.ow = 1; // 元の画像用
		this.oh = 1;
		this.w = 1; // 表示用
		this.h = 1;
		this.btnArray = [];
		this.btnParam = {};
		this.createButton();
		this.explainArray = [];
		this.createExplainText();
		this.state = ORIGINAL;
		this.target = [0, 0, 0]; // alpha用。
	}
	activate(){
		this.active = true;
	}
	inActivate(){
		this.active = false;
	}
  setSize(ow, oh){
		this.ow = ow;
		this.oh = oh;
		const ratio = Math.min(640 / ow, 480 / oh);
		this.w = ow * ratio;
		this.h = oh * ratio;
	}
	prepareImg(img){
	  this.originalImg = createGraphics(this.ow, this.oh);
	  this.usingImg = createGraphics(this.ow, this.oh, WEBGL);
	  this.originalImg.image(img, 0, 0, this.ow, this.oh, 0, 0, img.width, img.height);
		this.usingShader = this.usingImg.createShader(vs, fs);
	  this.usingImg.shader(this.usingShader);
		this.usingShader.setUniform("u_resolution", [this.ow, this.oh]);
		this.usingShader.setUniform("u_mode", 0);
		this.usingShader.setUniform("u_img", this.originalImg);
	  this.usingImg.quad(-1, -1, -1, 1, 1, 1, 1, -1);
	}
	createButton(){
		this.btnArray.push({name:"reset", color:color(23, 121, 53)}); // 編集解除
		this.btnArray.push({name:"gray", color:color(64)}); // グレーにする
		this.btnArray.push({name:"alpha", color:color(63, 72, 204)}); // アルファにする
		this.btnArray.push({name:"sobel", color:color(163, 73, 164)}); // sobelにする
		this.btnArray.push({name:"lapla", color:color(137, 176, 19)}); // ラプラシアンする
		this.btnArray.push({name:"save", color:color(237, 28, 36)}); // 保存する
		this.btnParam.w = 80;
		this.btnParam.h = 40;
		this.btnParam.itv = 15;
		this.btnParam.margin = 40 - 0.5 * this.btnParam.h;
	}
	createExplainText(){
		this.explainArray.push({content:"画像を元の状態にする", length:200});
		this.explainArray.push({content:"画像をモノクロにする", length:200});
		this.explainArray.push({content:"特定色を透明化する", length:180});
		this.explainArray.push({content:"ソベルフィルタをかける", length:220});
		this.explainArray.push({content:"ラプラシアンをかける", length:200});
		this.explainArray.push({content:"画像を保存する", length:140});
	}
	getActionId(mx, my){
		// そもそもアクティブでなかったら意味をなさない。
		if(!this.active){ return -1; }
		// マウス位置でバリデーション
    if(mx < 0 || mx > 640 || my < 480 || my > 560){ return -1; }
		my -= 480; // offSet.
		// (mx, my)がボタンの位置に該当するならidを返す、でなければ-1を返す。
		let param = this.btnParam;
		if(my < param.margin || my > param.margin + param.h || mx < param.itv){ return -1; }
		mx -= param.itv;
		const id = Math.floor(mx / (param.w + param.itv));
		// 細かい位置指定
		if(mx - id * (param.w + param.itv) > param.w){ return -1; }
		if(id >= this.btnArray.length){ return -1; }
		return id;
	}
	setTargetColor(mx, my){
		if(!this.active){ return; } // 画像設定前は変更不可
		if(this.state === ALPHA){ return; } // ALPHAになってるときは変更不可
		if(mx < 320 - this.w * 0.4 || mx > 320 + this.w * 0.4){ return; }
		if(my < 240 - this.h * 0.4 || my > 240 + this.h * 0.4){ return; }
		const col = get(mx, my);
		this.target[0] = col[0];
		this.target[1] = col[1];
		this.target[2] = col[2];
	}
	resetAction(){
		// 画像データのリセット
		this.usingShader.setUniform("u_resolution", [this.ow, this.oh]);
		this.usingShader.setUniform("u_mode", ORIGINAL);
		this.usingShader.setUniform("u_img", this.originalImg);
	  this.usingImg.quad(-1, -1, -1, 1, 1, 1, 1, -1);
		this.state = ORIGINAL;
		// ターゲットカラーをリセットする
		this.target[0] = 0;
		this.target[1] = 0;
		this.target[2] = 0;
	}
	monochromeAction(){
		// usingImgの画像をモノクロにする
		this.usingShader.setUniform("u_resolution", [this.ow, this.oh]);
		this.usingShader.setUniform("u_mode", GRAY);
		this.usingShader.setUniform("u_img", this.originalImg);
	  this.usingImg.quad(-1, -1, -1, 1, 1, 1, 1, -1);
		this.state = GRAY;
	}
	alphaAction(){
		// 設定された色の部分を透明化する
		this.usingShader.setUniform("u_resolution", [this.ow, this.oh]);
		this.usingShader.setUniform("u_mode", ALPHA);
		const r = this.target[0] / 255;
		const g = this.target[1] / 255;
		const b = this.target[2] / 255;
		this.usingShader.setUniform("u_target", [r, g, b]);
		this.usingShader.setUniform("u_img", this.originalImg);
	  this.usingImg.quad(-1, -1, -1, 1, 1, 1, 1, -1);
		this.state = ALPHA;
	}
	sobelAction(){
		// sobel filterをかける
		this.usingShader.setUniform("u_resolution", [this.ow, this.oh]);
		this.usingShader.setUniform("u_mode", SOBEL);
		this.usingShader.setUniform("u_img", this.originalImg);
	  this.usingImg.quad(-1, -1, -1, 1, 1, 1, 1, -1);
		this.state = SOBEL;
	}
	laplacianAction(){
		// laplacian filterをかける
		this.usingShader.setUniform("u_resolution", [this.ow, this.oh]);
		this.usingShader.setUniform("u_mode", LAPLA);
		this.usingShader.setUniform("u_img", this.originalImg);
	  this.usingImg.quad(-1, -1, -1, 1, 1, 1, 1, -1);
		this.state = LAPLA;
	}
	saveAction(){
		// usingImgの内容を保存する
		// this.stateを参照してそれにより名前をいじる
		switch(this.state){
			case ORIGINAL: this.usingImg.save(this.originalName + "_origin.png"); break;
			case GRAY: this.usingImg.save(this.originalName + "_gray.png"); break;
			case ALPHA: this.usingImg.save(this.originalName + "_alpha.png"); break;
			case SOBEL: this.usingImg.save(this.originalName + "_sobel.png"); break;
			case LAPLA: this.usingImg.save(this.originalName + "_lapla.png"); break;
		}
	}
	action(id){
		// actionはORIGINALのstateでなければ何も起こらないようにしようね。
		// ORIGINALで無い時にできるのはresetとsaveだけ（ここ重要）。
		if(id !== 0 && id !== this.btnArray.length - 1 && this.state !== ORIGINAL){ return; }
		switch(id){
			case 0: this.resetAction(); break;
			case 1: this.monochromeAction(); break;
			case 2: this.alphaAction(); break;
			case 3: this.sobelAction(); break;
			case 4: this.laplacianAction(); break;
			case 5: this.saveAction(); break;
		}
	}
	drawFrame(){
		let gr = this.frame;
		if(this.active){
			gr.background(220, 220, 255);
			gr.image(this.usingImg, 320 - this.w * 0.4, 240 - this.h * 0.4, this.w * 0.8, this.h * 0.8, 0, 0, this.ow, this.oh);
		}else{
			gr.background(220);
			gr.text("drag imageFile here.", 320, 240);
		}
	}
	drawConfig(){
		let gr = this.configBoard;
		let param = this.btnParam;
		gr.background(160);
		gr.textAlign(CENTER, CENTER);
		gr.textSize(25);
		let x, y;
		for(let i = 0; i < this.btnArray.length; i++){
			const btn = this.btnArray[i];
			x = param.itv + i * (param.itv + param.w);
			y = param.margin;
			if(this.active && i === this.state){
				gr.fill(238, 127, 36);
				gr.rect(x - 8, y - 8, param.w + 16, param.h + 16);
				gr.fill(160);
				gr.rect(x - 4, y - 4, param.w + 8, param.h + 8);
			}
			gr.fill(btn.color);
			gr.rect(x, y, param.w, param.h);
			gr.fill(255);
			gr.text(btn.name, param.itv + i * (param.itv + param.w) + param.w * 0.5, param.margin + param.h * 0.5);
		}
		// ターゲットカラーの表示
		gr.fill(this.target[0], this.target[1], this.target[2]);
		gr.square(640 - param.itv - param.h, param.margin, param.h);
    // 説明の表示
		const id = this.getActionId(mouseX, mouseY);
		if(id >= 0){
			const explain = this.explainArray[id];
			gr.textAlign(LEFT);
		  gr.textSize(20);
			gr.fill(0);
			gr.rect(mouseX, mouseY - 480, explain.length + 20, 30);
			gr.fill(255);
			gr.text(explain.content, mouseX + 10, mouseY - 480 + 15);
		}
	}
	draw(){
    this.drawFrame();
		this.drawConfig();
		image(this.frame, 0, 0);
		image(this.configBoard, 0, 480);
	}
}

function getImage(file){
	if(file.type !== "image"){ return; }
	if(editModule.active){ return; }
	// splitで名前を抽出
	editModule.originalName = file.name.split('.')[0];
	loadImage(file.data, setImage);
}

function setImage(img){
	let ow = img.width;
	let oh = img.height;
	if(Math.max(ow, oh) > SIZE_LIMIT){
		const factor = Math.min(SIZE_LIMIT / ow, SIZE_LIMIT / oh);
		ow *= factor;
		oh *= factor;
	}
	// 0.5倍の操作は共通。
	ow *= 0.5;
	oh *= 0.5;
	editModule.setSize(ow, oh);
	editModule.prepareImg(img);
	editModule.activate();
}

function mousePressed(){
	const actionId = editModule.getActionId(mouseX, mouseY);
	if(actionId >= 0){ editModule.action(actionId); }
}

function mouseClicked(){
	editModule.setTargetColor(mouseX, mouseY);
}
