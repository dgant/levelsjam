import fs from 'node:fs'
import { chromium } from 'playwright'

const [jobPath, resultPath] = process.argv.slice(2)

if (!jobPath || !resultPath) {
  console.error('Usage: node scripts/gpu-lightmap-worker.mjs <job.json> <result.json>')
  process.exit(1)
}

const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'))

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--disable-background-timer-throttling',
    '--disable-gpu-watchdog',
    '--disable-renderer-backgrounding',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=d3d11',
    '--use-gl=angle'
  ]
})

try {
  const page = await browser.newPage()
  const result = await page.evaluate((bakeJob) => {
    const canvas = document.createElement('canvas')
    canvas.width = bakeJob.atlasWidth
    canvas.height = bakeJob.atlasHeight
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: false,
      stencil: false
    })

    if (!gl) {
      throw new Error('WebGL2 is required for GPU lightmap baking')
    }

    if (!gl.getExtension('EXT_color_buffer_float')) {
      throw new Error('EXT_color_buffer_float is required for GPU lightmap baking')
    }

    const vertexSource = `#version 300 es
precision highp float;

const vec2 POSITIONS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2(3.0, -1.0),
  vec2(-1.0, 3.0)
);

void main() {
  gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0);
}
`

    const fragmentSource = `#version 300 es
precision highp float;
precision highp int;

const int MAX_WALLS = 320;
const int MAX_TORCHES = 96;
const int SKY_DIRECTION_COUNT = 13;
const int DIRECT_SPHERE_SAMPLE_COUNT = 6;
const int INDIRECT_SPHERE_SAMPLE_COUNT = 3;
const int INDIRECT_RAY_COUNT = 2;
const float GROUND_Y = 0.0;
const float PI = 3.141592653589793;
const float GOLDEN_RATIO = 1.618033988749895;

uniform sampler2D uWallTexture;
uniform sampler2D uTorchTexture;
uniform int uWallCount;
uniform int uTorchCount;
uniform int uSurfaceType;
uniform vec4 uRect;
uniform vec4 uSurfaceA;
uniform vec4 uSurfaceB;
uniform vec4 uGroundBounds;
uniform vec3 uGroundBounceAlbedo;
uniform vec3 uTorchLightColor;
uniform vec3 uSkyLightColor;
uniform vec3 uWallBounceAlbedo;
uniform float uCellSize;
uniform float uWallHeight;
uniform float uWallThickness;
uniform float uSampleEpsilon;
uniform float uSkyRayDistance;
uniform float uSconceRadius;
uniform float uTorchSourceRadius;
uniform float uTorchStrength;
uniform int uSupersampleGrid;
uniform bool uAlignUToRectEdges;

out vec4 outColor;

vec3 skyDirection(int index) {
  if (index == 0) return normalize(vec3(0.0, 1.0, 0.0));
  if (index == 1) return normalize(vec3(1.0, 1.0, 0.0));
  if (index == 2) return normalize(vec3(-1.0, 1.0, 0.0));
  if (index == 3) return normalize(vec3(0.0, 1.0, 1.0));
  if (index == 4) return normalize(vec3(0.0, 1.0, -1.0));
  if (index == 5) return normalize(vec3(1.0, 1.0, 1.0));
  if (index == 6) return normalize(vec3(1.0, 1.0, -1.0));
  if (index == 7) return normalize(vec3(-1.0, 1.0, 1.0));
  if (index == 8) return normalize(vec3(-1.0, 1.0, -1.0));
  if (index == 9) return normalize(vec3(2.0, 1.0, 0.0));
  if (index == 10) return normalize(vec3(-2.0, 1.0, 0.0));
  if (index == 11) return normalize(vec3(0.0, 1.0, 2.0));
  return normalize(vec3(0.0, 1.0, -2.0));
}

vec4 readWall(int wallIndex, int row) {
  return texelFetch(uWallTexture, ivec2(wallIndex, row), 0);
}

vec4 readTorch(int torchIndex, int row) {
  return texelFetch(uTorchTexture, ivec2(torchIndex, row), 0);
}

float hash11(float value) {
  return fract(sin(value * 12.9898) * 43758.5453123);
}

vec2 rotateWallLocalVector(float localX, float localZ, float yaw) {
  float cosine = cos(yaw);
  float sine = sin(yaw);
  return vec2(
    (localX * cosine) + (localZ * sine),
    (-localX * sine) + (localZ * cosine)
  );
}

void getSurfaceSample(float u, float v, out vec3 position, out vec3 normal) {
  if (uSurfaceType == 0) {
    position = vec3(
      uSurfaceA.x + (u * uSurfaceA.z),
      GROUND_Y,
      uSurfaceA.y + (v * uSurfaceA.w)
    );
    normal = vec3(0.0, 1.0, 0.0);
    return;
  }

  if (uSurfaceType == 1) {
    float localAlong = (u - 0.5) * uSurfaceA.z;
    float localY = (v - 0.5) * uWallHeight;
    float localZ = uSurfaceB.x * (uWallThickness * 0.5);
    vec2 rotatedPosition = rotateWallLocalVector(localAlong, localZ, uSurfaceA.w);
    vec2 rotatedNormal = rotateWallLocalVector(0.0, uSurfaceB.x, uSurfaceA.w);
    position = vec3(
      uSurfaceA.x + rotatedPosition.x,
      GROUND_Y + (uWallHeight * 0.5) + localY,
      uSurfaceA.y + rotatedPosition.y
    );
    normal = vec3(rotatedNormal.x, 0.0, rotatedNormal.y);
    return;
  }

  float localY = (v - 0.5) * uWallHeight;
  float localZ = (u - 0.5) * uWallThickness;
  float localX = uSurfaceB.x * (uCellSize * 0.5);
  vec2 rotatedPosition = rotateWallLocalVector(localX, localZ, uSurfaceA.z);
  vec2 rotatedNormal = rotateWallLocalVector(uSurfaceB.x, 0.0, uSurfaceA.z);
  position = vec3(
    uSurfaceA.x + rotatedPosition.x,
    GROUND_Y + (uWallHeight * 0.5) + localY,
    uSurfaceA.y + rotatedPosition.y
  );
  normal = vec3(rotatedNormal.x, 0.0, rotatedNormal.y);
}

bool segmentIntersectsBounds(vec3 start, vec3 end, vec3 boundsMin, vec3 boundsMax) {
  vec3 direction = end - start;
  float entry = 0.0;
  float exit = 1.0;

  for (int axis = 0; axis < 3; axis += 1) {
    float origin = start[axis];
    float delta = direction[axis];
    float minValue = boundsMin[axis];
    float maxValue = boundsMax[axis];

    if (abs(delta) < 0.000001) {
      if (origin < minValue || origin > maxValue) {
        return false;
      }
    } else {
      float nearValue = (minValue - origin) / delta;
      float farValue = (maxValue - origin) / delta;

      if (nearValue > farValue) {
        float swapValue = nearValue;
        nearValue = farValue;
        farValue = swapValue;
      }

      entry = max(entry, nearValue);
      exit = min(exit, farValue);

      if (entry > exit) {
        return false;
      }
    }
  }

  return exit > 0.0 && entry < 1.0;
}

bool rayIntersectsBounds(
  vec3 origin,
  vec3 direction,
  vec3 boundsMin,
  vec3 boundsMax,
  out float hitT,
  out vec3 hitNormal
) {
  float entry = 0.000001;
  float exit = 1.0e20;

  for (int axis = 0; axis < 3; axis += 1) {
    float delta = direction[axis];
    float originAxis = origin[axis];
    float minValue = boundsMin[axis];
    float maxValue = boundsMax[axis];

    if (abs(delta) < 0.000001) {
      if (originAxis < minValue || originAxis > maxValue) {
        return false;
      }
    } else {
      float nearValue = (minValue - originAxis) / delta;
      float farValue = (maxValue - originAxis) / delta;

      if (nearValue > farValue) {
        float swapValue = nearValue;
        nearValue = farValue;
        farValue = swapValue;
      }

      entry = max(entry, nearValue);
      exit = min(exit, farValue);

      if (entry > exit) {
        return false;
      }
    }
  }

  if (entry <= 0.000001) {
    return false;
  }

  hitT = entry;
  vec3 hitPosition = origin + (direction * hitT);
  float normalEpsilon = max(uSampleEpsilon * 1.5, 0.001);

  if (abs(hitPosition.x - boundsMin.x) <= normalEpsilon) {
    hitNormal = vec3(-1.0, 0.0, 0.0);
  } else if (abs(hitPosition.x - boundsMax.x) <= normalEpsilon) {
    hitNormal = vec3(1.0, 0.0, 0.0);
  } else if (abs(hitPosition.y - boundsMin.y) <= normalEpsilon) {
    hitNormal = vec3(0.0, -1.0, 0.0);
  } else if (abs(hitPosition.y - boundsMax.y) <= normalEpsilon) {
    hitNormal = vec3(0.0, 1.0, 0.0);
  } else if (abs(hitPosition.z - boundsMin.z) <= normalEpsilon) {
    hitNormal = vec3(0.0, 0.0, -1.0);
  } else {
    hitNormal = vec3(0.0, 0.0, 1.0);
  }

  return true;
}

bool segmentIntersectsLowerHemisphereCap(vec3 start, vec3 end, vec3 center, float radius) {
  vec3 direction = end - start;
  vec3 toStart = start - center;
  float a = dot(direction, direction);

  if (a > 0.00000001) {
    float b = 2.0 * dot(toStart, direction);
    float c = dot(toStart, toStart) - (radius * radius);
    float discriminant = (b * b) - (4.0 * a * c);

    if (discriminant >= 0.0) {
      float root = sqrt(discriminant);
      float nearValue = (-b - root) / (2.0 * a);
      float farValue = (-b + root) / (2.0 * a);

      for (int index = 0; index < 2; index += 1) {
        float t = index == 0 ? nearValue : farValue;

        if (t > 0.000001 && t < 0.999999) {
          float intersectionY = start.y + (direction.y * t);

          if (intersectionY <= center.y + 0.000001) {
            return true;
          }
        }
      }
    }
  }

  if (abs(direction.y) > 0.00000001) {
    float planeT = (center.y - start.y) / direction.y;

    if (planeT > 0.000001 && planeT < 0.999999) {
      float planeX = start.x + (direction.x * planeT);
      float planeZ = start.z + (direction.z * planeT);
      float distanceToCenterSquared =
        ((planeX - center.x) * (planeX - center.x)) +
        ((planeZ - center.z) * (planeZ - center.z));

      if (distanceToCenterSquared <= ((radius * radius) + 0.000001)) {
        return true;
      }
    }
  }

  return false;
}

bool isSegmentOccluded(vec3 samplePosition, vec3 targetPosition) {
  vec3 segmentMin = min(samplePosition, targetPosition);
  vec3 segmentMax = max(samplePosition, targetPosition);

  for (int wallIndex = 0; wallIndex < MAX_WALLS; wallIndex += 1) {
    if (wallIndex >= uWallCount) {
      break;
    }

    vec3 boundsMin = readWall(wallIndex, 0).xyz;
    vec3 boundsMax = readWall(wallIndex, 1).xyz;

    if (
      boundsMax.x < segmentMin.x ||
      boundsMin.x > segmentMax.x ||
      boundsMax.y < segmentMin.y ||
      boundsMin.y > segmentMax.y ||
      boundsMax.z < segmentMin.z ||
      boundsMin.z > segmentMax.z
    ) {
      continue;
    }

    if (segmentIntersectsBounds(samplePosition, targetPosition, boundsMin, boundsMax)) {
      return true;
    }
  }

  for (int torchIndex = 0; torchIndex < MAX_TORCHES; torchIndex += 1) {
    if (torchIndex >= uTorchCount) {
      break;
    }

    if (
      segmentIntersectsLowerHemisphereCap(
        samplePosition,
        targetPosition,
        readTorch(torchIndex, 1).xyz,
        uSconceRadius
      )
    ) {
      return true;
    }
  }

  return false;
}

vec3 sphereSampleDirection(int sampleIndex, float seed, int sampleCount) {
  float count = max(float(sampleCount), 1.0);
  float sampleValue = float(sampleIndex) + 0.5;
  float z = 1.0 - (2.0 * sampleValue / count);
  float radius = sqrt(max(0.0, 1.0 - (z * z)));
  float angle = 2.0 * PI * fract((float(sampleIndex) + seed) / GOLDEN_RATIO);

  return vec3(cos(angle) * radius, z, sin(angle) * radius);
}

vec3 cosineHemisphereDirection(vec3 normal, int sampleIndex, float seed) {
  float r1 = hash11(seed + (float(sampleIndex) * 17.371));
  float r2 = hash11(seed + (float(sampleIndex) * 29.713) + 5.231);
  float phi = 2.0 * PI * r1;
  float radius = sqrt(r2);
  float localX = cos(phi) * radius;
  float localZ = sin(phi) * radius;
  float localY = sqrt(max(0.0, 1.0 - r2));
  vec3 tangent = abs(normal.y) < 0.95
    ? normalize(cross(vec3(0.0, 1.0, 0.0), normal))
    : normalize(cross(vec3(1.0, 0.0, 0.0), normal));
  vec3 bitangent = normalize(cross(normal, tangent));

  return normalize((tangent * localX) + (normal * localY) + (bitangent * localZ));
}

bool traceScene(
  vec3 origin,
  vec3 direction,
  out vec3 hitPosition,
  out vec3 hitNormal,
  out vec3 hitAlbedo
) {
  bool hit = false;
  float nearestT = 1.0e20;
  vec3 nearestNormal = vec3(0.0);
  vec3 nearestAlbedo = vec3(0.0);

  if (direction.y < -0.000001) {
    float groundT = (GROUND_Y - origin.y) / direction.y;
    vec3 groundPosition = origin + (direction * groundT);

    if (
      groundT > 0.000001 &&
      groundT < nearestT &&
      groundPosition.x >= uGroundBounds.x &&
      groundPosition.x <= uGroundBounds.z &&
      groundPosition.z >= uGroundBounds.y &&
      groundPosition.z <= uGroundBounds.w
    ) {
      hit = true;
      nearestT = groundT;
      nearestNormal = vec3(0.0, 1.0, 0.0);
      nearestAlbedo = uGroundBounceAlbedo;
    }
  }

  for (int wallIndex = 0; wallIndex < MAX_WALLS; wallIndex += 1) {
    if (wallIndex >= uWallCount) {
      break;
    }

    float wallT = 0.0;
    vec3 wallNormal = vec3(0.0);

    if (
      rayIntersectsBounds(
        origin,
        direction,
        readWall(wallIndex, 0).xyz,
        readWall(wallIndex, 1).xyz,
        wallT,
        wallNormal
      ) &&
      wallT < nearestT
    ) {
      hit = true;
      nearestT = wallT;
      nearestNormal = wallNormal;
      nearestAlbedo = uWallBounceAlbedo;
    }
  }

  if (!hit) {
    return false;
  }

  hitPosition = origin + (direction * nearestT);
  hitNormal = nearestNormal;
  hitAlbedo = nearestAlbedo;
  return true;
}

vec3 sampleSkylight(vec3 samplePosition, vec3 sampleNormal) {
  vec3 rayStart = samplePosition + (sampleNormal * uSampleEpsilon);
  float accumulatedWeight = 0.0;
  vec3 color = vec3(0.0);

  for (int index = 0; index < SKY_DIRECTION_COUNT; index += 1) {
    vec3 direction = skyDirection(index);
    float lambert = dot(sampleNormal, direction);

    if (lambert <= 0.0) {
      continue;
    }

    accumulatedWeight += lambert;

    if (isSegmentOccluded(rayStart, rayStart + (direction * uSkyRayDistance))) {
      continue;
    }

    color += uSkyLightColor * lambert;
  }

  if (accumulatedWeight <= 0.000001) {
    return vec3(0.0);
  }

  return color / accumulatedWeight;
}

vec3 accumulateTorchLighting(
  vec3 samplePosition,
  vec3 sampleNormal,
  float seed,
  int sphereSampleCount
) {
  vec3 litColor = vec3(0.0);
  float sourceRadius = max(uTorchSourceRadius, 0.001);
  int effectiveSphereSampleCount = max(sphereSampleCount, 1);

  for (int torchIndex = 0; torchIndex < MAX_TORCHES; torchIndex += 1) {
    if (torchIndex >= uTorchCount) {
      break;
    }

    vec3 torchPosition = readTorch(torchIndex, 0).xyz;
    vec3 torchAccumulated = vec3(0.0);

    for (int sphereSampleIndex = 0; sphereSampleIndex < DIRECT_SPHERE_SAMPLE_COUNT; sphereSampleIndex += 1) {
      if (sphereSampleIndex >= effectiveSphereSampleCount) {
        break;
      }

      float sampleSeed = seed + float(torchIndex) * 0.37;
      vec3 emitterPosition =
        torchPosition +
        (sphereSampleDirection(sphereSampleIndex, sampleSeed, effectiveSphereSampleCount) * sourceRadius);
      vec3 toTorch = emitterPosition - samplePosition;
      float distanceToTorch = length(toTorch);

      if (distanceToTorch <= 0.000001) {
        continue;
      }

      vec3 direction = toTorch / distanceToTorch;
      float lambert = dot(sampleNormal, direction);

      if (lambert <= 0.0) {
        continue;
      }

      vec3 rayStart = samplePosition + (sampleNormal * uSampleEpsilon);

      if (isSegmentOccluded(rayStart, emitterPosition)) {
        continue;
      }

      float falloff = 1.0 / max(distanceToTorch * distanceToTorch, sourceRadius * sourceRadius);
      torchAccumulated += uTorchLightColor * (lambert * falloff * uTorchStrength);
    }

    litColor += torchAccumulated / float(effectiveSphereSampleCount);
  }

  return litColor;
}

vec3 directAndSkyLighting(
  vec3 samplePosition,
  vec3 sampleNormal,
  float seed,
  int sphereSampleCount
) {
  return
    max(vec3(0.0), accumulateTorchLighting(samplePosition, sampleNormal, seed, sphereSampleCount)) +
    max(vec3(0.0), sampleSkylight(samplePosition, sampleNormal));
}

vec3 sampleTwoBounceDiffuseLighting(vec3 samplePosition, vec3 sampleNormal, float seed) {
  vec3 indirect = vec3(0.0);
  vec3 rayStart = samplePosition + (sampleNormal * uSampleEpsilon);

  for (int bounceSampleIndex = 0; bounceSampleIndex < INDIRECT_RAY_COUNT; bounceSampleIndex += 1) {
    vec3 firstDirection = cosineHemisphereDirection(
      sampleNormal,
      bounceSampleIndex,
      seed + 101.0
    );
    vec3 firstHitPosition = vec3(0.0);
    vec3 firstHitNormal = vec3(0.0);
    vec3 firstHitAlbedo = vec3(0.0);

    if (!traceScene(rayStart, firstDirection, firstHitPosition, firstHitNormal, firstHitAlbedo)) {
      continue;
    }

    float firstSeed = seed + float(bounceSampleIndex) * 0.271;
    vec3 firstLighting = directAndSkyLighting(
      firstHitPosition + (firstHitNormal * uSampleEpsilon),
      firstHitNormal,
      firstSeed,
      INDIRECT_SPHERE_SAMPLE_COUNT
    );
    vec3 secondBounce = vec3(0.0);
    vec3 secondDirection = cosineHemisphereDirection(
      firstHitNormal,
      bounceSampleIndex + INDIRECT_RAY_COUNT,
      firstSeed + 211.0
    );
    vec3 secondHitPosition = vec3(0.0);
    vec3 secondHitNormal = vec3(0.0);
    vec3 secondHitAlbedo = vec3(0.0);

    if (
      traceScene(
        firstHitPosition + (firstHitNormal * uSampleEpsilon),
        secondDirection,
        secondHitPosition,
        secondHitNormal,
        secondHitAlbedo
      )
    ) {
      vec3 secondLighting = directAndSkyLighting(
        secondHitPosition + (secondHitNormal * uSampleEpsilon),
        secondHitNormal,
        firstSeed + 409.0,
        INDIRECT_SPHERE_SAMPLE_COUNT
      );

      secondBounce = secondHitAlbedo * secondLighting;
    }

    indirect += firstHitAlbedo * (firstLighting + secondBounce);
  }

  return indirect / float(INDIRECT_RAY_COUNT);
}

void main() {
  float column = floor(gl_FragCoord.x - uRect.x);
  float row = floor(gl_FragCoord.y - uRect.y);
  vec3 accumulatedColor = vec3(0.0);
  float sampleCount = 0.0;

  for (int sampleRow = 0; sampleRow < 2; sampleRow += 1) {
    if (sampleRow >= uSupersampleGrid) {
      break;
    }

    for (int sampleColumn = 0; sampleColumn < 2; sampleColumn += 1) {
      if (sampleColumn >= uSupersampleGrid) {
        break;
      }

      float gridSize = float(uSupersampleGrid);
      float u = uAlignUToRectEdges && uRect.z > 1.0
        ? column / (uRect.z - 1.0)
        : (column + ((float(sampleColumn) + 0.5) / gridSize)) / uRect.z;
      float v = (row + ((float(sampleRow) + 0.5) / gridSize)) / uRect.w;
      vec3 samplePosition;
      vec3 sampleNormal;

      getSurfaceSample(u, v, samplePosition, sampleNormal);
      float seed = 0.371 + (float(sampleColumn + (sampleRow * 2)) * 0.173);
      accumulatedColor +=
        directAndSkyLighting(
          samplePosition,
          sampleNormal,
          seed,
          DIRECT_SPHERE_SAMPLE_COUNT
        ) +
        sampleTwoBounceDiffuseLighting(samplePosition, sampleNormal, seed + 19.0);
      sampleCount += 1.0;
    }
  }

  outColor = vec4(accumulatedColor / max(sampleCount, 1.0), 1.0);
}
`

    const compileShader = (type, source) => {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed')
      }

      return shader
    }

    const program = gl.createProgram()
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource))
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource))
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Program link failed')
    }

    const targetTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, targetTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      bakeJob.atlasWidth,
      bakeJob.atlasHeight,
      0,
      gl.RGBA,
      gl.FLOAT,
      null
    )

    const framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      targetTexture,
      0
    )

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('GPU lightmap framebuffer is incomplete')
    }

    const createFloatTexture = (width, height, data) => {
      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        width,
        height,
        0,
        gl.RGBA,
        gl.FLOAT,
        data
      )
      return texture
    }

    const wallTextureWidth = Math.max(1, bakeJob.walls.length)
    const wallData = new Float32Array(wallTextureWidth * 2 * 4)

    for (let index = 0; index < bakeJob.walls.length; index += 1) {
      const wall = bakeJob.walls[index]
      wallData[index * 4] = wall.minX
      wallData[(index * 4) + 1] = wall.minY
      wallData[(index * 4) + 2] = wall.minZ
      wallData[(index * 4) + 3] = 0
      const maxOffset = (wallTextureWidth + index) * 4
      wallData[maxOffset] = wall.maxX
      wallData[maxOffset + 1] = wall.maxY
      wallData[maxOffset + 2] = wall.maxZ
      wallData[maxOffset + 3] = 0
    }

    const torchTextureWidth = Math.max(1, bakeJob.torches.length)
    const torchData = new Float32Array(torchTextureWidth * 4 * 4)

    for (let index = 0; index < bakeJob.torches.length; index += 1) {
      const torch = bakeJob.torches[index]
      let offset = index * 4
      torchData[offset] = torch.torchPosition.x
      torchData[offset + 1] = torch.torchPosition.y
      torchData[offset + 2] = torch.torchPosition.z
      torchData[offset + 3] = 0

      offset = (torchTextureWidth + index) * 4
      torchData[offset] = torch.sconcePosition.x
      torchData[offset + 1] = torch.sconcePosition.y
      torchData[offset + 2] = torch.sconcePosition.z
      torchData[offset + 3] = 0

      offset = ((torchTextureWidth * 2) + index) * 4
      torchData[offset] = torch.wallCenter.x
      torchData[offset + 1] = torch.wallCenter.z
      torchData[offset + 2] = torch.wallAxis === 'x' ? 0 : 1
      torchData[offset + 3] = 0

      offset = ((torchTextureWidth * 3) + index) * 4
      torchData[offset] = torch.normal.x
      torchData[offset + 1] = 0
      torchData[offset + 2] = torch.normal.z
      torchData[offset + 3] = 0
    }

    const wallTexture = createFloatTexture(wallTextureWidth, 2, wallData)
    const torchTexture = createFloatTexture(torchTextureWidth, 4, torchData)
    const locations = {
      alignUToRectEdges: gl.getUniformLocation(program, 'uAlignUToRectEdges'),
      cellSize: gl.getUniformLocation(program, 'uCellSize'),
      groundBounceAlbedo: gl.getUniformLocation(program, 'uGroundBounceAlbedo'),
      groundBounds: gl.getUniformLocation(program, 'uGroundBounds'),
      rect: gl.getUniformLocation(program, 'uRect'),
      sampleEpsilon: gl.getUniformLocation(program, 'uSampleEpsilon'),
      sconceRadius: gl.getUniformLocation(program, 'uSconceRadius'),
      skyLightColor: gl.getUniformLocation(program, 'uSkyLightColor'),
      skyRayDistance: gl.getUniformLocation(program, 'uSkyRayDistance'),
      supersampleGrid: gl.getUniformLocation(program, 'uSupersampleGrid'),
      surfaceA: gl.getUniformLocation(program, 'uSurfaceA'),
      surfaceB: gl.getUniformLocation(program, 'uSurfaceB'),
      surfaceType: gl.getUniformLocation(program, 'uSurfaceType'),
      torchCount: gl.getUniformLocation(program, 'uTorchCount'),
      torchLightColor: gl.getUniformLocation(program, 'uTorchLightColor'),
      torchSourceRadius: gl.getUniformLocation(program, 'uTorchSourceRadius'),
      torchStrength: gl.getUniformLocation(program, 'uTorchStrength'),
      torchTexture: gl.getUniformLocation(program, 'uTorchTexture'),
      wallCount: gl.getUniformLocation(program, 'uWallCount'),
      wallBounceAlbedo: gl.getUniformLocation(program, 'uWallBounceAlbedo'),
      wallHeight: gl.getUniformLocation(program, 'uWallHeight'),
      wallTexture: gl.getUniformLocation(program, 'uWallTexture'),
      wallThickness: gl.getUniformLocation(program, 'uWallThickness')
    }

    gl.useProgram(program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, wallTexture)
    gl.uniform1i(locations.wallTexture, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, torchTexture)
    gl.uniform1i(locations.torchTexture, 1)
    gl.uniform1i(locations.wallCount, bakeJob.walls.length)
    gl.uniform1i(locations.torchCount, bakeJob.torches.length)
    gl.uniform1f(locations.cellSize, bakeJob.constants.cellSize)
    gl.uniform1f(locations.wallHeight, bakeJob.constants.wallHeight)
    gl.uniform1f(locations.wallThickness, bakeJob.constants.wallThickness)
    gl.uniform1f(locations.sampleEpsilon, bakeJob.constants.sampleEpsilon)
    gl.uniform1f(locations.skyRayDistance, bakeJob.constants.skyRayDistance)
    gl.uniform1f(locations.sconceRadius, bakeJob.constants.sconceRadius)
    gl.uniform1f(locations.torchSourceRadius, bakeJob.constants.torchSourceRadius)
    gl.uniform1f(locations.torchStrength, bakeJob.constants.torchStrength)
    gl.uniform4fv(locations.groundBounds, bakeJob.constants.groundBounds)
    gl.uniform3fv(locations.groundBounceAlbedo, bakeJob.constants.groundBounceAlbedo)
    gl.uniform3fv(locations.torchLightColor, bakeJob.constants.torchLightColor)
    gl.uniform3fv(locations.skyLightColor, bakeJob.constants.skyLightColor)
    gl.uniform3fv(locations.wallBounceAlbedo, bakeJob.constants.wallBounceAlbedo)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.SCISSOR_TEST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.viewport(0, 0, bakeJob.atlasWidth, bakeJob.atlasHeight)
    gl.scissor(0, 0, bakeJob.atlasWidth, bakeJob.atlasHeight)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const renderTileSize = 32

    for (const surface of bakeJob.surfaces) {
      const rect = surface.rect
      gl.uniform4f(locations.rect, rect.x, rect.y, rect.width, rect.height)
      gl.uniform1i(locations.surfaceType, surface.type)
      gl.uniform4fv(locations.surfaceA, surface.surfaceA)
      gl.uniform4fv(locations.surfaceB, surface.surfaceB)
      gl.uniform1i(locations.supersampleGrid, surface.supersampleGrid)
      gl.uniform1i(locations.alignUToRectEdges, surface.alignUToRectEdges ? 1 : 0)

      for (let tileY = rect.y; tileY < rect.y + rect.height; tileY += renderTileSize) {
        const tileHeight = Math.min(renderTileSize, rect.y + rect.height - tileY)

        for (let tileX = rect.x; tileX < rect.x + rect.width; tileX += renderTileSize) {
          const tileWidth = Math.min(renderTileSize, rect.x + rect.width - tileX)

          gl.viewport(tileX, tileY, tileWidth, tileHeight)
          gl.scissor(tileX, tileY, tileWidth, tileHeight)
          gl.drawArrays(gl.TRIANGLES, 0, 3)
        }
      }
    }

    const pixels = new Float32Array(bakeJob.atlasWidth * bakeJob.atlasHeight * 4)
    gl.readPixels(
      0,
      0,
      bakeJob.atlasWidth,
      bakeJob.atlasHeight,
      gl.RGBA,
      gl.FLOAT,
      pixels
    )

    const toHalfFloat = (value) => {
      if (Number.isNaN(value)) {
        return 0x7e00
      }

      if (value === Infinity) {
        return 0x7c00
      }

      if (value === -Infinity) {
        return 0xfc00
      }

      const sign = value < 0 ? 0x8000 : 0
      let absolute = Math.abs(value)

      if (absolute === 0) {
        return sign
      }

      if (absolute >= 65504) {
        return sign | 0x7bff
      }

      if (absolute < 0.00006103515625) {
        return sign | Math.round(absolute / 0.000000059604644775390625)
      }

      let exponent = Math.floor(Math.log2(absolute))
      let mantissa = absolute / (2 ** exponent) - 1
      let halfExponent = exponent + 15
      let halfMantissa = Math.round(mantissa * 1024)

      if (halfMantissa === 1024) {
        halfMantissa = 0
        halfExponent += 1
      }

      return sign | (halfExponent << 10) | (halfMantissa & 0x3ff)
    }

    const bytes = new Uint8Array(bakeJob.atlasWidth * bakeJob.atlasHeight * 3 * 2)
    const view = new DataView(bytes.buffer)

    for (let pixelIndex = 0; pixelIndex < bakeJob.atlasWidth * bakeJob.atlasHeight; pixelIndex += 1) {
      const sourceOffset = pixelIndex * 4
      const outputOffset = pixelIndex * 6

      view.setUint16(outputOffset, toHalfFloat(Math.max(0, pixels[sourceOffset])), true)
      view.setUint16(outputOffset + 2, toHalfFloat(Math.max(0, pixels[sourceOffset + 1])), true)
      view.setUint16(outputOffset + 4, toHalfFloat(Math.max(0, pixels[sourceOffset + 2])), true)
    }

    const bytesToBase64 = (byteArray) => {
      let binary = ''
      const chunkSize = 0x8000

      for (let index = 0; index < byteArray.length; index += chunkSize) {
        binary += String.fromCharCode(...byteArray.subarray(index, index + chunkSize))
      }

      return btoa(binary)
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')

    return {
      dataBase64: bytesToBase64(bytes),
      renderer: debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      vendor: debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
        : gl.getParameter(gl.VENDOR)
    }
  }, job)

  fs.writeFileSync(resultPath, JSON.stringify(result))
} finally {
  await browser.close()
}
