"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dependency = void 0;
class Dependency {
    name;
    path;
    entrypointList;
    name;
    dependencyPath;
    entrypointList;
    constructor(name, path, entrypointList) {
        this.name = name;
        this.path = path;
        this.entrypointList = entrypointList;
        // TODO
    }
    static loadFromPath(projectRootPath, dependencyPath) {
        return new Dependency(projectRootPath, dependencyPath);
    }
}
exports.Dependency = Dependency;
