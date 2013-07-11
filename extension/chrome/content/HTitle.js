/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var HTitle = {
    DEBUG: false,
    ENABLED: true,
    
    window: null,
    isFullscreen: false,
    stateBeforeFullscreen: 0,
    firstState: 0,
    magicCounter1: 0,
    magicCounter2: 0,
    
    needMagic: true,
    aMaximize: [ 202, 302, 402 ],
    aShowTitle: [],
    aNotMaximize: [], /* 101, 301 */
    
    isMouseDown: false,
    
    _find_path_to_exec: function(name) {
        var file = Components.classes["@mozilla.org/file/local;1"]
                             .createInstance(Components.interfaces.nsIFile);
        
        var env = Components.classes["@mozilla.org/process/environment;1"]
                            .getService(Components.interfaces.nsIEnvironment);
        var path = env.get("PATH").split(":");
        
        HTitle.log("PATH = " + path, "DEBUG");
        
        var path_to_exec = null
        for (var i = 0; i < path.length; i++) {
            var full_path_to_exec = path[i] + "/" + name;
            file.initWithPath(full_path_to_exec);
            if (file.exists() && file.isExecutable()) {
                path_to_exec = full_path_to_exec;
                HTitle.log("Path to " + name + " is \"" + full_path_to_exec + "\"", "DEBUG");
                break;
            }
            else {
                HTitle.log("File \"" + full_path_to_exec + "\" doesn't exists", "DEBUG");
            }
        }
        
        return path_to_exec;
    },
    
    _run: function(path, args, needWait=true) {
        var file = Components.classes["@mozilla.org/file/local;1"]
                                 .createInstance(Components.interfaces.nsIFile);
        
        file.initWithPath(path);
        
        var process = Components.classes["@mozilla.org/process/util;1"]
                                .createInstance(Components.interfaces.nsIProcess);
        
        try {
            process.init(file);
            process.run(needWait, args, args.length);
        }
        catch (error) {
            HTitle.log(error.message, "ERROR");
            return -1;
        }
        
        if (needWait) {
            HTitle.log("Exit value is \"" + process.exitValue + "\"", "DEBUG");
            return process.exitValue;
        }
        else
            return 0;
    },
    
    init: function() {
        HTitle.DEBUG = Application.prefs.getValue("extensions.htitle.debug", false);
        
        if (Application.prefs.getValue("extensions.htitle.check_gnome_shell", false)) {
            HTitle.log("Start checking DE", "DEBUG");
            
            var pidof_path = HTitle._find_path_to_exec("pidof");
            
            if (pidof_path) {
                var exitValue = HTitle._run(pidof_path, ["gnome-shell"]);
                if (exitValue == 1) {
                    HTitle.ENABLED = false;
                }
            }
            else {
                HTitle.log("pidof doesn't exist", "ERROR");
            }
        }
        
        HTitle.log("Extension initialization...", "DEBUG");
        
        var result = -2;
        var bash_path = HTitle._find_path_to_exec("bash");
        if (bash_path) {
            var str = 'for I in `xwininfo -tree -root | grep "(\\"Navigator\\" \\"Firefox\\")" | sed "s/[ ]*//" | grep -o "0x[0-9a-f]*"`; do xprop -id $I -f _GTK_HIDE_TITLEBAR_WHEN_MAXIMIZED 32c -set _GTK_HIDE_TITLEBAR_WHEN_MAXIMIZED 1; done';
            HTitle.log(str, "INFO");
            var args = ["-c", str]
            result = HTitle._run(bash_path, args, false);
        }
        
        if (result != 0) {
            HTitle.log("bash doesn't exist", "ERROR");
            
            HTitle.window = document.getElementById("main-window");
            
            window.addEventListener("resize",         HTitle.onWindowStateChange);
            window.addEventListener("sizemodechange", HTitle.onWindowStateChange);
            window.addEventListener("mousemove",      HTitle.disableMagic);
            
            HTitle.logWindowState("init");
        }
    },
    
    isNeedMagic: function(mCounter1, mCounter2, mArray) {
        mNumber = mCounter1 * 100 + mCounter2;
        
        var length = mArray.length;
        for (var i = 0; i < length; i++) {
            if (mArray[i] == mNumber)
                return true;
        }
        return false;
    },
    
    onWindowStateChange: function(e) {
        if (HTitle.window == null) {
            if ((HTitle.window = document.getElementById("main-window")) == null) {
                HTitle.log("HTitle.window == null", "DEBUG");
                return;
            }
        }
        
        if (HTitle.firstState == 0) {
            HTitle.firstState = window.windowState;
            HTitle.logWindowState("FirstState");
        }
        
        if (window.windowState == window.STATE_FULLSCREEN) {
            HTitle.isFullscreen = true;
            return;
        }
        
        if (HTitle.isFullscreen) {
            HTitle.isFullscreen = false;
            if (HTitle.stateBeforeFullscreen == window.STATE_MAXIMIZED)
                window.maximize();
            return;
        }
        
        if (HTitle.DEBUG || (HTitle.magicCounter1 < 5 && HTitle.magicCounter2 < 5) ) {
            switch (e.type) {
                case "resize": HTitle.magicCounter1++; break;
                case "sizemodechange": HTitle.magicCounter2++; break;
            }
        }
        
        HTitle.logWindowState(e.type);
        
        if (e.type == "sizemodechange") {
            if (window.windowState == window.STATE_MAXIMIZED)
                if (HTitle.needMagic) {
                    // Not need maximizied
                    if (
                            HTitle.firstState == window.STATE_NORMAL &&
                            HTitle.isNeedMagic(HTitle.magicCounter1, HTitle.magicCounter2, HTitle.aNotMaximize)
                    ) {
                        window.restore();
                        HTitle.needMagic = false;
                    }
                    else
                        HTitle.window.setAttribute("hidechrome", true);
                }
                else
                    HTitle.window.setAttribute("hidechrome", true);
            else {
                if (HTitle.needMagic) {
                    // Need maximizied
                    if (
                            HTitle.firstState == window.STATE_MAXIMIZED &&
                            HTitle.isNeedMagic(HTitle.magicCounter1, HTitle.magicCounter2, HTitle.aMaximize)
                    ) {
                        window.maximize();
                        HTitle.needMagic = false;
                    }
                    
                    // Need show title
                    if (
                            HTitle.firstState == window.STATE_NORMAL &&
                            HTitle.isNeedMagic(HTitle.magicCounter1, HTitle.magicCounter2, HTitle.aShowTitle)
                    ) {
                        HTitle.window.setAttribute("hidechrome", false);
                        HTitle.needMagic = false;
                    }
                }
            }
        }
        
        if (e.type == "resize" && window.windowState == window.STATE_NORMAL && HTitle.window.getAttribute("hidechrome")) {
            HTitle.window.setAttribute("hidechrome", false);
        }
        
        HTitle.stateBeforeFullscreen = window.windowState;
        
        HTitle.logWindowState(e.type + "_end");
    },
    
    onClick: function() {
        HTitle.logWindowState("onClick");
        if (window.windowState == window.STATE_NORMAL && HTitle.window.getAttribute("hidechrome")) {
            HTitle.window.setAttribute("hidechrome", false);
        }
    },
    
    logWindowStateCount: 0,
    logWindowStateMessage: "\n",
    logWindowState: function(from) {
        if (HTitle.DEBUG == false)
            return
        
        switch (window.windowState) {
            case window.STATE_MAXIMIZED:   var windowState = "maximized"; break;
            case window.STATE_NORMAL:      var windowState = "normal"; break;
            case window.STATE_FULLSCREEN:  var windowState = "fullscreen"; break;
            default: var windowState = window.windowState.toString();
        }
        
        HTitle.logWindowStateCount++;
        HTitle.logWindowStateMessage += "Action = " + from + "; windowState = " + windowState + ";  hidechrome = " + HTitle.window.getAttribute("hidechrome") + "; magicCounter1 = " + HTitle.magicCounter1 + "; magicCounter2 = " + HTitle.magicCounter2 + "; isFullscreen = " + HTitle.isFullscreen + "\n";
        
        if (HTitle.logWindowStateCount > 50) {
            HTitle.log(HTitle.logWindowStateMessage, "DEBUG");
            HTitle.logWindowStateCount = 0;
            HTitle.logWindowStateMessage = "\n";
        }        
    },
    
    log: function(message, level="ERROR") {
        if (HTitle.DEBUG == false && level == "DEBUG")
            return;
        
        var timestamp = Date.now();
        Application.console.log("[" + timestamp + "] " + level + " HTitle: " + message);
    },
    
    disableMagic: function(e) {
        HTitle.logWindowState("disableMagic");

        HTitle.needMagic = false;
        window.removeEventListener("mousemove", HTitle.disableMagic);
    },
}

window.addEventListener("load", HTitle.init);
