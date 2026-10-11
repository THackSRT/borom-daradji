<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateCompanySettingsRequest;
use App\Http\Resources\CompanySettingsResource;
use App\Http\Resources\PublicCompanyResource;
use App\Models\CompanySetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CompanySettingsController extends Controller
{
    public function show(): CompanySettingsResource
    {
        return new CompanySettingsResource(CompanySetting::current());
    }

    public function showPublic(): PublicCompanyResource
    {
        return new PublicCompanyResource(CompanySetting::current());
    }

    public function update(UpdateCompanySettingsRequest $request): CompanySettingsResource
    {
        $settings = CompanySetting::current();
        $settings->update($request->validated());

        return new CompanySettingsResource($settings);
    }

    public function updateLogo(Request $request): CompanySettingsResource
    {
        $request->validate([
            'logo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
        ]);

        $settings = CompanySetting::current();
        $previous = $settings->logo_path;

        $settings->logo_path = $request->file('logo')->store('company', 'public');
        $settings->save();

        if ($previous) {
            Storage::disk('public')->delete($previous);
        }

        return new CompanySettingsResource($settings);
    }

    public function destroyLogo(): CompanySettingsResource
    {
        $settings = CompanySetting::current();

        if ($settings->logo_path) {
            Storage::disk('public')->delete($settings->logo_path);
            $settings->logo_path = null;
            $settings->save();
        }

        return new CompanySettingsResource($settings);
    }
}
