<?php

ob_start();
mjl_activity_render_review($view);
return ob_get_clean();
