package com.clowneon1.streampe

import org.junit.Assert.*
import org.junit.Test

class UpdateCheckerTest {

    @Test
    fun testIsNewerVersionStandard() {
        assertTrue("2.2.9 is newer than 2.2.8", UpdateChecker.isNewerVersion("2.2.9", "2.2.8"))
        assertTrue("2.3.0 is newer than 2.2.8", UpdateChecker.isNewerVersion("2.3.0", "2.2.8"))
        assertTrue("3.0.0 is newer than 2.2.8", UpdateChecker.isNewerVersion("3.0.0", "2.2.8"))
    }

    @Test
    fun testIsNewerVersionEqualOrOlder() {
        assertFalse("Same version is not newer", UpdateChecker.isNewerVersion("2.2.8", "2.2.8"))
        assertFalse("2.2.7 is not newer than 2.2.8", UpdateChecker.isNewerVersion("2.2.7", "2.2.8"))
        assertFalse("2.1.9 is not newer than 2.2.8", UpdateChecker.isNewerVersion("2.1.9", "2.2.8"))
        assertFalse("1.9.9 is not newer than 2.2.8", UpdateChecker.isNewerVersion("1.9.9", "2.2.8"))
    }

    @Test
    fun testIsNewerVersionWithVPrefix() {
        assertTrue("v2.2.9 is newer than 2.2.8", UpdateChecker.isNewerVersion("v2.2.9", "2.2.8"))
        assertTrue("v2.2.9 is newer than v2.2.8", UpdateChecker.isNewerVersion("v2.2.9", "v2.2.8"))
        assertFalse("v2.2.8 is not newer than 2.2.8", UpdateChecker.isNewerVersion("v2.2.8", "2.2.8"))
    }

    @Test
    fun testIsNewerVersionMultiDigitSegments() {
        assertTrue("2.10.0 is newer than 2.2.8", UpdateChecker.isNewerVersion("2.10.0", "2.2.8"))
        assertTrue("2.2.10 is newer than 2.2.8", UpdateChecker.isNewerVersion("2.2.10", "2.2.8"))
        assertFalse("2.2.8 is not newer than 2.2.10", UpdateChecker.isNewerVersion("2.2.8", "2.2.10"))
    }

    @Test
    fun testIsNewerVersionWithPreReleaseSuffix() {
        // Tag with suffix like "v2.3.0-beta.1"
        assertTrue("v2.3.0-beta.1 should compare base semver against 2.2.8", UpdateChecker.isNewerVersion("v2.3.0-beta.1", "2.2.8"))
    }

    @Test
    fun testIsNewerVersionInvalidInputs() {
        assertFalse("Empty latest tag is not newer", UpdateChecker.isNewerVersion("", "2.2.8"))
        assertFalse("Blank latest tag is not newer", UpdateChecker.isNewerVersion("   ", "2.2.8"))
        assertFalse("Non-semver text is not newer", UpdateChecker.isNewerVersion("latest-release", "2.2.8"))
    }
}
