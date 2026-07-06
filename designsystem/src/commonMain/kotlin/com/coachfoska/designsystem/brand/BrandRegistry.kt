package com.coachfoska.designsystem.brand

import com.coachfoska.designsystem.brand.foska.FoskaBrand

object BrandRegistry {
    val all: List<Brand> = listOf(FoskaBrand)

    /** Falls back to FoskaBrand for unknown ids so a misconfigured build still boots branded. */
    fun fromId(id: String): Brand = all.firstOrNull { it.id == id } ?: FoskaBrand
}
