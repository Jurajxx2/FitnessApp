package com.coachfoska.app.data.remote.dto

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RecipeDtoTest {

    @Test fun `RecipeDto maps featured flag to domain isFeatured`() {
        val dto = RecipeDto(id = "r1", name = "Oats", featured = true)
        assertTrue(dto.toDomain().isFeatured)
    }

    @Test fun `RecipeDto defaults featured to false`() {
        val dto = RecipeDto(id = "r2", name = "Toast")
        assertFalse(dto.toDomain().isFeatured)
        assertEquals("r2", dto.toDomain().id)
    }
}
