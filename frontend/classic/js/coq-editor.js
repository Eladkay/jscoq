/* jsCoq
 *
 * Copyright (C) 2016-2019 Emilio J. Gallego Arias, Mines ParisTech, Paris.
 * Copyright (C) 2018-2022 Shachar Itzhaky, Technion - Israel Institute of Technology, Haifa
 * Copyright (C) 2019-2022 Emilio J. Gallego Arias, Inria, Paris
 */

"use strict";

/**
 * Interface for Coq Editor's
 *
 * @interface
 */
class ICoqEditor {

    getValue() { }

    onChange(newContent) { }

    clearMarks() { }

    markDiagnostic(diag) { }
}


// Local Variables:
// js-indent-level: 4
// End:
