var SCREEN_WIDTH = 2560;
var SCREEN_HEIGHT = 1024;
var container;
var particle; //粒子

var camera;
var scene;
var renderer;

var starSnow = 1;
var snowTime = "";

var particles = [];

var particleImage = new Image();
//THREE.ImageUtils.loadTexture( "img/ParticleSmoke.png" );
particleImage.src = 'images/hongbao.png';

function init() {

	container = document.createElement('div'); //container：画布实例;
	container.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden";
	container.className = 'hongbao';
	document.body.appendChild(container);

	camera = new THREE.PerspectiveCamera(40, SCREEN_WIDTH / SCREEN_HEIGHT, 10, 10000);
	camera.position.z = 1000;
	//camera.position.y = 50;

	scene = new THREE.Scene();
	scene.add(camera);

	renderer = new THREE.CanvasRenderer();
	renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
	renderer.setClearColorHex(0xffffff, 0);
	var material = new THREE.ParticleBasicMaterial({
		map: new THREE.Texture(particleImage)
	});

	for (var i = 0; i < 70; i++) {

		particle = new Particle3D(material);
		particle.position.x = Math.random() * 2000 - 1000;

		particle.position.z = Math.random() * 2000 - 1000;
		particle.position.y = Math.random() * 2000 - 1000;
		//particle.position.y = Math.random() * (1600-particle.position.z)-1000;
		particle.scale.x = particle.scale.y = 0.5;
		scene.add(particle);

		particles.push(particle);
	}

	container.appendChild(renderer.domElement);

	snowTime = setInterval(loop, 1000 / 60);

}

function loop() {
	for (var i = 0; i < particles.length; i++) {
		var particle = particles[i];
		particle.updatePhysics();

		with(particle.position) {
			if ((y < -1000) && starSnow) {
				y += 2000;
			}

			if (x > 1000) x -= 2000;
			else if (x < -1000) x += 2000;
			if (z > 1000) z -= 2000;
			else if (z < -1000) z += 2000;
		}
	}

	camera.lookAt(scene.position);

	renderer.render(scene, camera);
}