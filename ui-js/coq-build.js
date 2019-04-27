const fs = require('fs'),
      glob = require('glob'),
      path = require('path')
      neatjson = require('neatjson');

require('./coq-manager'); // needed for Array.equals :\


/**
 * List package directories and .cmo files for configuring the load path.
 */
class CoqProject {
    constructor() {
        this.path = [];  /* [[logical, physical], ...] */
        this.cmos = [];
        this.vfiles = [];

        this.json_format_opts = 
            { padding: 1, afterColon: 1, afterComma: 1, wrap: 80 };

        this.zip_file_opts = 
            { date: new Date("1/1/2000 UTC"), // dummy date (otherwise, zip changes every time it is created...)
              createFolders: false };
    }

    add(base_dir, base_name) {
        this.path.push([this._prefix(base_name), [base_dir, '.']]);
        this.cmos.push(...this._cmoFiles(base_dir));
    }
    addRecursive(base_dir, base_name) {
        var prefix = this._prefix(base_name);
        this.add(base_dir, prefix);
        for (let dir of glob.sync('**/', {cwd: base_dir})) {
            dir = dir.replace(/[/]$/,'');
            var pkg = prefix.concat(dir.split('/').filter(x => x));
            this.add(path.join(base_dir, dir), pkg);
        }
    }
    _vFiles(dir) {
        return glob.sync('*.v', {cwd: dir}).map(fn => path.join(dir, fn));
    }
    _cmoFiles(dir) {
        return glob.sync('*.cm[oa]', {cwd: dir}).map(fn => path.join(dir, fn));
    }
    _prefix(name) { return this._module_name(name); }

    _module_name(name) {
        return (typeof name === 'string') ? name.split('.') : name;
    }

    /**
     * Merges another project into the current one.
     * @param {CoqProject} other the other project
     */
    join(other) {
        this.path.push(...other.path);
        this.cmos.push(...other.cmos);
        this.vfiles.push(...other.vfiles);
        return this;
    }

    toLogicalName(filename) {
        var dir = path.dirname(filename), 
            base = path.basename(filename).replace(/[.]v$/, '');
        for (let [logical, [physical]] of this.path) {
            if (physical === dir) return logical.concat([base])
        }
    }

    /**
     * Finds all .v files in physical directories of the project
     * and adds them to `this.vfiles`.
     */
    collectModules() {
        for (let [_, [dir]] of this.path) {
            this.vfiles.push(...this._vFiles(dir));
        }
    }

    searchModule(prefix, module_name, exact=false) {
        prefix = this._prefix(prefix);
        module_name = this._module_name(module_name);

        let startsWith = (arr, prefix) => arr.slice(0, prefix.length).equals(prefix);
        let endsWith = (arr, suffix) => suffix.length == 0 || arr.slice(-suffix.length).equals(suffix);

        let module_matches = exact ? name => name.equals(prefix.concat(module_name))
                                   : name => startsWith(name, prefix) &&
                                             endsWith(name, module_name);

        for (let vfile of this.vfiles) {
            let logical_name = this.toLogicalName(vfile);
            if (module_matches(logical_name)) {
                return logical_name;
            }
        }
    }

    createManifest(name, archive) {
        var manifest = {desc: name || '', deps: [], pkgs: []},
            vo_files_logical = this.vfiles.map(vf => this.toLogicalName(vf)),
            pkgs = [];

        var vo_files_of_pkg = (pkg_id) => vo_files_logical.filter(vf => 
                vf.length === pkg_id.length + 1 && vf.slice(0, pkg_id.length).equals(pkg_id))
                .map(vf => `${vf[vf.length - 1]}.vo`);

        for (let [logical, _] of this.path) {
            pkgs.push({pkg_id: logical,
                vo_files: vo_files_of_pkg(logical).map(x => [x, '']),   // TODO digest
                cma_files: []});
        }

        manifest.pkgs = pkgs;
        if (archive) manifest.archive = archive;

        return manifest;
    }

    createManifestJSON(name, archive) {
        return neatjson.neatJSON(this.createManifest(name, archive), 
                                 this.json_format_opts);
    }

    writeManifest(to_file, name /*optional*/, archive /*optional*/) {
        name = name || this._guessName(to_file);
        fs.writeFileSync(to_file, this.createManifestJSON(name, archive));
    }

    toZip(save_as, name /*optional*/) {
        const JSZip = require('jszip');
              
        if (save_as) name = name || this._guessName(save_as);

        var z = new JSZip(), promises = [];
        z.file('coq-pkg.json', this.createManifestJSON(name));
        for (let fn of this.vfiles) {
            let logical_name = this.toLogicalName(fn);
            if (logical_name) {
                var lfile = this._localFile(`${fn}o`);
                if (lfile)
                    z.file(`${path.join(...logical_name)}.vo`, lfile,
                           this.zip_file_opts);
            }
            else
                console.warn(`skipped '${fn}' (not in path).`);
        }
        if (save_as) {
            return z.generateNodeStream()
                .pipe(fs.createWriteStream(save_as))
                .on('finish', () => { console.log(`wrote '${save_as}'.`); return z; });
        }
        else
            return Promise.resolve(z);
    }

    _localFile(filename) {
        try {
            fs.lstatSync(filename);
            return fs.createReadStream(filename);
        }
        catch (e) {
            console.error(`skipped '${filename}' (not found).`);
        }
    }

    _guessName(filename) {
        return path.basename(filename).replace(/[.][^.]*$/,'');  // base sans extension
    }

    /**
     * Configures a project from flags in _CoqProject format, i.e. -R ..., -Q ...,
     * and list of .v files.
     * @param {string} coq_project_text content of _CoqProject definition file
     * @param {string} project_root location of _CoqProject file
     */
    static fromFileText(coq_project_text, project_root) {
        var proj = new CoqProject();

        for (let line of coq_project_text.split(/\n+/)) {
            var mo;
            if (mo = /\s*(-[RQ])\s+(\S+)\s+(\S+)/.exec(line)) {
                var [flag, physical, logical] = [mo[1], mo[2], mo[3]];
                physical = path.join(project_root, physical);
                if (flag === '-R')
                    proj.addRecursive(physical, logical);
                else
                    proj.add(physical, logical);
            }
            else
                proj.vfiles.push(...line.split(/\s+/).filter(w => /[.]v$/.exec(w))
                    .map(fn => path.join(project_root, fn)));
        }

        if (proj.vfiles.length === 0)
            proj.collectModules();

        return proj;
    }

    /**
     * Configures a project from a _CoqProject file.
     * @param {string} coq_project_filename file in _CoqProject format
     * @param {string?} project_root base directory for project;
     *   if omitted, the directory part of `coq_project_filename` is used.
     */
    static fromFile(coq_project_filename, project_root=null) {
        return CoqProject.fromFileText(
            fs.readFileSync(coq_project_filename, 'utf-8'),
            project_root || path.dirname(coq_project_filename))
    }

    static fromFileOrDirectory(coq_project_dir_or_filename, project_root=null) {
        var is_dir;
        try {
            is_dir = fs.lstatSync(coq_project_dir_or_filename).isDirectory;
        }
        catch (e) { throw new Error(`not found: '${coq_project_dir_or_filename}'`); }

        return CoqProject.fromFile(is_dir 
            ? path.join(coq_project_dir_or_filename, '_CoqProject') 
            : coq_project_dir_or_filename, project_root);
    }
    
}


class SearchPath {
    constructor(packages=[]) {
        this.packages = packages;
    }

    toLogicalName(filename) {
        for (let pkg of this.packages) {
            let lu = pkg.toLogicalName(filename);
            if (lu) return {pkg: pkg, dirpath: lu};
        }
    }

    searchModule(prefix, module_name, exact=false) {
        for (let pkg of this.packages) {
            let lu = pkg.searchModule(prefix, module_name, exact);
            if (lu) return {pkg: pkg, dirpath: lu};
        }
    }

    prepend(pkg) {
        var idx = this.packages.indexOf(pkg);
        if (idx != 0) {
            if (idx > 0) this.packages.splice(idx, 1);
            this.packages.splice(0, 0, pkg);
        }
    }
}

class CoqDep {
    constructor() {
        this.search_path = new SearchPath();
        this.deps = new Map();
    }

    processVernacFile(filename) {
        var mod = this.search_path.toLogicalName(filename);
        if (mod) {
            this.processVernac(fs.readFileSync(filename, 'utf-8'), 
                               mod.dirpath);
        }
    }

    processVernac(v_text, logical_name) {
        var key = logical_name.join('.');

        // Strip comments
        v_text = v_text.replace(/\(\*([^*]|[*][^)])*?\*\)/g, ' ');

        // Split sentences
        for (let sentence of v_text.split(/[.](?:\s|$)/)) {
            var mo = /^\s*(?:From\s+(.*?)\s+)?Require(\s+(?:Import|Export))*\s+(.*)/
                     .exec(sentence);
            if (mo) {
                var [_, prefix, import_export, modnames] = mo;
                modnames = modnames.split(/\s+/);

                for (let modname of modnames) {
                    let lu = this.search_path.searchModule(prefix || [], modname);
                    if (lu) 
                        this.deps.set(key,
                            (this.deps.get(key) || []).concat([lu]));
                }
            }
        }
    }

    processProject(proj) {
        this.search_path.prepend(proj);

        for (let vfile of proj.vfiles) {
            this.processVernacFile(vfile);
        }

        return this;
    }

    /**
     * Basically, topological sort.
     * (TODO: allow parallel builds?)
     * @param {CoqProject} proj a project with vfiles to compile
     */
    buildPlan(proj) {
        var plan = [],
            worklist = proj.vfiles.map(fn => 
                [fn, proj.toLogicalName(fn)]).filter(x => x[1]);

        while (worklist.length > 0) {
            var progress = new Set();
            for (let [fn, logical_name] of worklist) {
                let deps = (this.deps.get(logical_name.join('.')) || [])
                    .filter(entry => entry.pkg === proj && 
                            worklist.some(x => x[1].equals(entry.dirpath)));
                if (deps.length === 0) {
                    plan.push({input: fn, dirpath: logical_name});
                    progress.add(fn);
                }
            }
            if (progress.size === 0)
                throw new Error('cyclic dependency detected');
            worklist = worklist.filter(x => !progress.has(x[0]));
        }

        return plan;
    }
}


class CoqC {

    constructor(coq) {
        this.coq = coq || new HeadlessCoqManager();

        this.vo_output = {};

        var dummy = {
            coqCancelled: () => { },
            coqLog:       () => { }        
        };

        this.coq.coq.observers.push(this, dummy);

        this.json_format_opts = 
            { padding: 1, afterColon: 1, afterComma: 1, wrap: 80 };
        this.zip_file_opts = 
            { createFolders: false };
    }

    spawn() {
        var c = new CoqC(this.coq.spawn());
        c.vo_output = this.vo_output;  /* tie child's output to parent's */
        return c;
    }

    /**
     * Causes compilation to continue from a previous checkpoint, using .vo
     * files stored in a Zip archive.
     * @param {JSZip or string} zip a Zip containing previous compilation
     *   artifacts, or a filename to load the Zip from.
     */
    continueFrom(zip) {
        if (typeof zip === 'string') {
            var load = fs.readFileSync(zip);
            return require('JSZip').loadAsync(load).then(z => this.continueFrom(z));
        }
        else {
            var upload = [];
            zip.forEach((fn, content) => {
                if (/[.]vo$/.exec(fn)) {
                    fn = `/lib/${fn}`;
                    upload.push(
                        content.async('arraybuffer').then(data => {
                            this.vo_output[fn] = data;
                            this.coq.coq.put(fn, data);
                        })
                    );
                }
            });
            return Promise.all(upload);
        }
    }

    /**
     * Compiles a .v file, producing a .vo file and placing it in the worker's
     * '/lib/'.
     * Multiple jobs are processed sequentially.
     * @param {array or object} entries a compilation job with fields 
     *   {input, dirpath}, or an array of them.
     */
    batchCompile(entries) {
        if (Array.isArray(entries)) {
            return entries.reduce(
                (promise, entry) => promise.then(() => this.spawn().batchCompile(entry)),
                Promise.resolve());
        }
        else {
            var entry = entries, out_fn = `/lib/${entry.dirpath.join('/')}.vo`;
            if (this.vo_output.hasOwnProperty(out_fn)) return Promise.resolve();

            console.log("Compiling: ", entry.input);
            this.coq.options.top_name = entry.dirpath.join('.');
            this.coq.options.compile = {input: entry.input,
                                        output: out_fn};
            this.coq.start();
            return this.coq.when_done.promise.then(() => this.coq.terminate());
        }
    }

    coqGot(filename, buf) {
        this.vo_output[filename] = buf;
        let idx = this.coq.coq.observers.indexOf(this);
        if (idx > -1) this.coq.coq.observers.splice(idx, 1);
    }

    toZip(save_as) {
        const JSZip = require('jszip'),
              base_dir = "/lib",
              name = save_as ? path.basename(save_as).replace(/[.][^.]*$/,'') : undefined;
        var z = new JSZip();
        z.file('coq-pkg.json', neatjson.neatJSON(this.createManifest(name), 
                                                 this.json_format_opts));
        for (let fn in this.vo_output) {
            z.file(path.relative(base_dir, fn), this.vo_output[fn], 
                   this.zip_file_opts);
        }
        if (save_as) {
            return z.generateNodeStream()
                .pipe(fs.createWriteStream(save_as))
                .on('finish', () => { console.log(`wrote '${save_as}'.`); return z; });
        }
        else
            return Promise.resolve(z);
    }

    createManifest(name) {
        const base_dir = "/lib";
        var dirs = new Map(), pkgs = [];
        for (let fn in this.vo_output) {
            var dir = path.dirname(path.relative(base_dir, fn)),
                base = path.basename(fn);
            if (dirs.has(dir)) dirs.get(dir).push(base);
            else dirs.set(dir, [base]);
        }
        for (let dir of dirs.keys()) {
            pkgs.push({pkg_id: dir.split('/'),
                       vo_files: dirs.get(dir).map(x => [x, ''])});  // TODO: digest
        }
        return {desc: name || '', deps: [], pkgs: pkgs};
    }

}



module.exports = {CoqProject, CoqDep, CoqC}



if (module && module.id == '.') {
    var opts = require('commander')
        .option('--create-package <pkg>',        'write a .coq-pkg archive (requires --project)')
        .option('--create-manifest <json>',      'write a .json package definition (requires --project)')
        .option('--project <dir>',               'use project at dir (must contain a _CoqProject file)')
        .option('--projects <dir,...>',          'use a comma-separated list of project directories')
        .option('--name <name>',                 'set package name; if unspecified, inferred from output filename')
        .parse(process.argv);

    var proj, pkg;

    if (typeof opts.name !== 'string') opts.name = undefined; // name is a function otherwise :/

    if (opts.project) {
        proj = CoqProject.fromFileOrDirectory(opts.project);
    }

    if (opts.projects) {
        var projs = opts.projects.split(',').map(fn => CoqProject.fromFileOrDirectory(fn));

        if (proj) projs.splice(0, 0, proj);

        proj = projs.reduce((proj1, proj2) => proj1.join(proj2));
    }
        
    if (opts.createPackage) {
        pkg = opts.createPackage;
        if (proj)
            proj.toZip(opts.createPackage, opts.name);
        else
            console.error("Create package from what? Use --project to specify source.");
    }

    if (opts.createManifest) {
        if (proj)
            proj.writeManifest(opts.createManifest, opts.name, 
                pkg ? path.basename(pkg) : undefined);
        else
            console.error("Create manifest of what? Use --project to specify source.");
    }
}
